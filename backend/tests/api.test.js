import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { setup, fakeAi, fakeOcr, RESUME_TEXT, goodProfile } from "./helpers.js";
import { countRecords } from "../src/db/repository.js";

let ctx;
before(async () => {
  ctx = await setup();
});
after(async () => {
  await ctx.teardown();
});
beforeEach(async () => {
  await ctx.reset();
  ctx.ai.calls.length = 0;
});

async function saveProfile() {
  ctx.ai.queue(goodProfile());
  const ex = await request(ctx.app).post("/api/profiles/extract").send({ text: RESUME_TEXT }).expect(200);
  const saved = await request(ctx.app).post("/api/profiles/confirm").send({ draft_id: ex.body.draft_id }).expect(201);
  return saved.body.record;
}

// ---------------- Successful flow ----------------

test("SUCCESS: resume text -> validated preview -> confirm -> profile created in SQLite", async () => {
  ctx.ai.queue(goodProfile());
  const ex = await request(ctx.app).post("/api/profiles/extract").send({ text: RESUME_TEXT }).expect(200);

  assert.equal(ex.body.validation.status, "valid");
  assert.equal(ex.body.validation.can_save, true);
  assert.equal(ex.body.preview.full_name, "Priya Sharma");
  assert.equal(countRecords("profiles"), 0, "nothing is saved before confirmation");

  // PII safeguard: contact details never reach the AI provider.
  const sentToAi = ctx.ai.calls[0].messages.map((m) => m.content).join("\n");
  assert.ok(!sentToAi.includes("priya.sharma@example.com"));
  assert.ok(!sentToAi.includes("98765"));
  assert.ok(sentToAi.includes("[REDACTED_EMAIL]"));
  assert.equal(ex.body.privacy.redacted_emails, 1);

  const saved = await request(ctx.app).post("/api/profiles/confirm").send({ draft_id: ex.body.draft_id }).expect(201);
  assert.equal(saved.body.operation, "created");
  assert.equal(saved.body.table, "profiles");
  assert.equal(saved.body.record.contact.email_masked, "pr**********@example.com");
  assert.equal(saved.body.record.contact.phone_masked.endsWith("3210"), true);
  assert.equal(countRecords("profiles"), 1);

  // The draft is consumed: confirming twice is rejected.
  const again = await request(ctx.app).post("/api/profiles/confirm").send({ draft_id: ex.body.draft_id }).expect(404);
  assert.equal(again.body.error.code, "DRAFT_NOT_FOUND");
});

test("SUCCESS (update): same candidate re-uploaded -> existing_match -> confirm update bumps version", async () => {
  const first = await saveProfile();
  ctx.ai.queue(goodProfile({ headline: "Senior full-stack developer" }));
  const ex = await request(ctx.app).post("/api/profiles/extract").send({ text: RESUME_TEXT }).expect(200);
  assert.equal(ex.body.existing_match.id, first.id);

  const upd = await request(ctx.app)
    .post("/api/profiles/confirm")
    .send({ draft_id: ex.body.draft_id, mode: "update", target_id: first.id })
    .expect(200);
  assert.equal(upd.body.operation, "updated");
  assert.equal(upd.body.record.version, 2);
  assert.equal(upd.body.record.headline, "Senior full-stack developer");
  assert.equal(countRecords("profiles"), 1);
});

// ---------------- Missing fields ----------------

test("MISSING FIELD: AI cannot find the name -> preview incomplete, save blocked until user fills it", async () => {
  ctx.ai.queue(goodProfile({ full_name: null, missing_fields: ["full_name", "location"] }));
  const ex = await request(ctx.app).post("/api/profiles/extract").send({ text: RESUME_TEXT.replace("Priya Sharma\n", "") }).expect(200);
  assert.equal(ex.body.validation.status, "incomplete");
  assert.equal(ex.body.validation.can_save, false);
  assert.deepEqual(ex.body.validation.missing_required, ["full_name"]);

  const blocked = await request(ctx.app).post("/api/profiles/confirm").send({ draft_id: ex.body.draft_id }).expect(422);
  assert.equal(blocked.body.error.code, "REQUIRED_FIELDS_MISSING");
  assert.equal(countRecords("profiles"), 0);

  const fixed = { ...ex.body.preview, full_name: "Priya Sharma" };
  const saved = await request(ctx.app).post("/api/profiles/confirm").send({ draft_id: ex.body.draft_id, data: fixed }).expect(201);
  assert.equal(saved.body.record.ai.edited_by_user, true);
});

test("PLACEHOLDERS: 'N/A' / 'Unknown' from the AI are treated as missing, not as data", async () => {
  ctx.ai.queue(goodProfile({ full_name: "N/A", location: "Unknown" }));
  const ex = await request(ctx.app).post("/api/profiles/extract").send({ text: RESUME_TEXT }).expect(200);
  assert.equal(ex.body.preview.full_name, null);
  assert.equal(ex.body.preview.location, null);
  assert.equal(ex.body.validation.status, "incomplete");
});

// ---------------- Invalid AI output ----------------

test("INVALID AI OUTPUT: schema violation is repaired with one retry", async () => {
  ctx.ai.queue(goodProfile({ skills: "React, Node" }), goodProfile());
  const ex = await request(ctx.app).post("/api/profiles/extract").send({ text: RESUME_TEXT }).expect(200);
  assert.equal(ex.body.ai.attempts, 2);
  const repairMsg = ctx.ai.calls[1].messages.at(-1).content;
  assert.match(repairMsg, /skills/);
});

test("INVALID AI OUTPUT: still invalid after repair -> 422 AI_OUTPUT_INVALID, nothing saved", async () => {
  ctx.ai.queue("this is not json", goodProfile({ skills: [{ name: "React", category: "superpower" }] }));
  const res = await request(ctx.app).post("/api/profiles/extract").send({ text: RESUME_TEXT }).expect(422);
  assert.equal(res.body.error.code, "AI_OUTPUT_INVALID");
  assert.ok(res.body.error.details.length > 0);
});

test("EDITED DATA is re-validated: invalid enum in user edit -> 400", async () => {
  ctx.ai.queue(goodProfile());
  const ex = await request(ctx.app).post("/api/profiles/extract").send({ text: RESUME_TEXT }).expect(200);
  const bad = { ...ex.body.preview, skills: [{ ...ex.body.preview.skills[0], proficiency: "godlike" }] };
  const res = await request(ctx.app).post("/api/profiles/confirm").send({ draft_id: ex.body.draft_id, data: bad }).expect(400);
  assert.equal(res.body.error.code, "VALIDATION_FAILED");
  assert.equal(res.body.error.details[0].path, "skills.0.proficiency");
});

test("GROUNDING: evidence not present in the input is flagged as a warning", async () => {
  const p = goodProfile();
  p.skills.push({ name: "Kubernetes", category: "tool", proficiency: "expert", years: 5, evidence: "managed kubernetes clusters at scale" });
  ctx.ai.queue(p);
  const ex = await request(ctx.app).post("/api/profiles/extract").send({ text: RESUME_TEXT }).expect(200);
  assert.equal(ex.body.validation.status, "valid_with_warnings");
  assert.ok(ex.body.validation.warnings.some((w) => w.includes("kubernetes")));
});

// ---------------- Invalid input / errors ----------------

test("INVALID INPUT: empty, too short, wrong type, bad JSON, unknown feature", async () => {
  assert.equal((await request(ctx.app).post("/api/profiles/extract").send({}).expect(400)).body.error.code, "EMPTY_INPUT");
  assert.equal((await request(ctx.app).post("/api/profiles/extract").send({ text: "hello" }).expect(400)).body.error.code, "INPUT_TOO_SHORT");
  assert.equal((await request(ctx.app).post("/api/profiles/extract").send({ text: 42 }).expect(400)).body.error.code, "INVALID_INPUT");
  const img = await request(ctx.app).post("/api/profiles/extract").attach("file", Buffer.from("fake"), { filename: "cv.zip", contentType: "application/zip" }).expect(415);
  assert.equal(img.body.error.code, "UNSUPPORTED_FILE_TYPE");
  const badJson = await request(ctx.app).post("/api/profiles/extract").set("content-type", "application/json").send("{bad").expect(400);
  assert.equal(badJson.body.error.code, "INVALID_JSON");
  assert.equal((await request(ctx.app).post("/api/salaries/extract").send({ text: RESUME_TEXT }).expect(404)).body.error.code, "UNKNOWN_FEATURE");
  assert.equal(ctx.ai.calls.length, 0, "AI is never called for invalid input");
});

test("ERROR: AI provider rate limit surfaces as 429 AI_RATE_LIMITED", async () => {
  ctx.ai.queue(Object.assign(new Error("rate limited"), { status: 429 }));
  const res = await request(ctx.app).post("/api/profiles/extract").send({ text: RESUME_TEXT }).expect(429);
  assert.equal(res.body.error.code, "AI_RATE_LIMITED");
});

test("DOCUMENT INPUT: TXT upload is parsed", async () => {
  ctx.ai.queue(goodProfile());
  const res = await request(ctx.app).post("/api/profiles/extract").attach("file", Buffer.from(RESUME_TEXT), { filename: "cv.txt", contentType: "text/plain" }).expect(200);
  assert.equal(res.body.source.type, "document");
  assert.equal(res.body.source.file_name, "cv.txt");
});

// ---------------- Other features ----------------

test("JOB MATCH: requires a profile; score is computed in code, not by the AI", async () => {
  const jd = "Hiring a Junior Full Stack Developer. Required: React, Node.js, SQL. Nice to have: Docker. 2+ years experience.";
  const noProfile = await request(ctx.app).post("/api/job-matches/extract").send({ text: jd }).expect(400);
  assert.equal(noProfile.body.error.code, "PROFILE_REQUIRED");

  const profile = await saveProfile();
  ctx.ai.calls.length = 0;
  ctx.ai.queue({
    job_title: "Junior Full Stack Developer",
    company: null,
    seniority: "Junior",
    employment_type: null,
    location: null,
    min_experience_years: 2,
    required_skills: ["React", "Node.js", "SQL"],
    preferred_skills: ["Docker"],
    responsibilities: [],
    qualifications: [],
    missing_fields: ["company", "location", "employment_type"],
  });
  const ex = await request(ctx.app).post("/api/job-matches/extract").send({ text: jd, profile_id: profile.id }).expect(200);
  const c = ex.body.extras.comparison;
  assert.deepEqual(c.matched_required, ["React", "Node.js"]);
  assert.deepEqual(c.missing_required, ["SQL"]);
  assert.equal(c.experience_fit, 100);
  // 0.7*(2/3) + 0.2*0 + 0.1*1 = 0.5667 -> 57
  assert.equal(c.match_score, 57);
  assert.equal(ex.body.preview.seniority, "junior");
  assert.ok(!ctx.ai.calls[0].messages.some((m) => m.content.includes("Priya")), "candidate data is not sent for JD extraction");

  const saved = await request(ctx.app).post("/api/job-matches/confirm").send({ draft_id: ex.body.draft_id }).expect(201);
  assert.equal(saved.body.record.comparison.match_score, 57);
  assert.equal(saved.body.record.profile, profile.id);
});

test("LEARNING PLAN: timeframe overrun and uncovered high-priority gaps are warned", async () => {
  ctx.ai.queue({
    target_role: "Data Analyst",
    timeframe_weeks: 4,
    current_skills: [{ name: "Excel", proficiency: "intermediate" }],
    required_skills: [{ name: "SQL", required_proficiency: "intermediate", importance: "Must Have" }],
    skill_gaps: [
      { skill: "SQL", current_level: "none", target_level: "intermediate", priority: "high", reason: "Core querying skill" },
      { skill: "Power BI", current_level: "none", target_level: "beginner", priority: "high", reason: "Dashboards" },
    ],
    milestones: [{ order: 1, title: "SQL basics", duration_weeks: 6, objectives: ["SELECT, JOIN"], resources: ["SQLBolt"], deliverable: "10 queries", skills_covered: ["SQL"] }],
    missing_fields: [],
  });
  const ex = await request(ctx.app).post("/api/learning-plans/extract").send({ text: "I know Excel and want to become a data analyst in 4 weeks." }).expect(200);
  assert.equal(ex.body.preview.required_skills[0].importance, "must_have");
  assert.equal(ex.body.validation.status, "valid_with_warnings");
  assert.ok(ex.body.validation.warnings.some((w) => w.includes("exceeds")));
  assert.ok(ex.body.validation.warnings.some((w) => w.includes("Power BI")));
  await request(ctx.app).post("/api/learning-plans/confirm").send({ draft_id: ex.body.draft_id }).expect(201);
});

test("INTERVIEW FEEDBACK from AUDIO: transcribed, extracted, saved", async () => {
  fakeAi.transcript = "Mock interview for backend role. I explained REST APIs clearly but struggled with SQL joins and spoke too fast.";
  ctx.ai.queue({
    role: "Backend developer",
    interview_type: "technical",
    overall_readiness: "developing",
    strengths: [{ point: "Clear API explanation", evidence: "explained REST APIs clearly" }],
    improvement_areas: [{ area: "SQL joins", observation: "struggled with SQL joins", suggestion: "Practise join queries", priority: "high" }],
    next_practice_tasks: [{ task: "Solve 10 join problems", focus_area: "SQL joins", duration_minutes: 45, due_in_days: 3 }],
    missing_fields: [],
  });
  const ex = await request(ctx.app)
    .post("/api/interview-feedback/extract")
    .attach("file", Buffer.from("fake-audio"), { filename: "notes.webm", contentType: "audio/webm" })
    .expect(200);
  assert.equal(ex.body.source.type, "audio");
  assert.ok(ex.body.source.preview_text.includes("SQL joins"));
  assert.equal(ex.body.validation.status, "valid");
  await request(ctx.app).post("/api/interview-feedback/confirm").send({ draft_id: ex.body.draft_id }).expect(201);
});

test("PROJECT BRIEF: create, then PUT update (re-validated), then delete needs confirmation", async () => {
  ctx.ai.queue({
    title: "TrailMate",
    tagline: "Plan hikes with friends",
    problem_statement: "Group hike planning is scattered across chats.",
    target_users: "Weekend hikers",
    difficulty: "intermediate",
    estimated_weeks: 4,
    tech_stack: [{ name: "React", purpose: "UI" }],
    core_features: ["Trip creation", "Invite friends", "Gear checklist"],
    stretch_features: [],
    skills_demonstrated: ["React"],
    milestones: [{ week: 1, goal: "Wireframes" }],
    success_criteria: ["Deployed app"],
    missing_fields: [],
  });
  const ex = await request(ctx.app).post("/api/project-briefs/extract").send({ text: "I love hiking and know React. Suggest a portfolio project." }).expect(200);
  const saved = await request(ctx.app).post("/api/project-briefs/confirm").send({ draft_id: ex.body.draft_id }).expect(201);
  const id = saved.body.record.id;

  const upd = await request(ctx.app).put(`/api/project-briefs/${id}`).send({ data: { title: "TrailMate Pro", estimated_weeks: 6 } }).expect(200);
  assert.equal(upd.body.record.title, "TrailMate Pro");
  assert.equal(upd.body.record.version, 2);

  const bad = await request(ctx.app).put(`/api/project-briefs/${id}`).send({ data: { core_features: [] } }).expect(422);
  assert.equal(bad.body.error.code, "REQUIRED_FIELDS_MISSING");

  assert.equal((await request(ctx.app).delete(`/api/project-briefs/${id}`).expect(400)).body.error.code, "CONFIRMATION_REQUIRED");
  await request(ctx.app).delete(`/api/project-briefs/${id}?confirm=true`).expect(200);
  await request(ctx.app).get(`/api/project-briefs/${id}`).expect(404);
  assert.equal((await request(ctx.app).get("/api/project-briefs/not-an-id").expect(400)).body.error.code, "INVALID_ID");
});

test("OCR: image upload (or image-only PDF) is read with OCR and labelled as such", async () => {
  fakeOcr.text = RESUME_TEXT;
  ctx.ai.queue(goodProfile());
  const res = await request(ctx.app).post("/api/profiles/extract").attach("file", Buffer.from("png-bytes"), { filename: "resume.png", contentType: "image/png" }).expect(200);
  assert.equal(res.body.source.extraction, "ocr");
  assert.equal(res.body.privacy.redacted_emails, 1, "OCR text is redacted like any other input");
  assert.equal(res.body.validation.status, "valid");
});

test("OCR FAILURE: unreadable image -> 422 OCR_FAILED, AI never called", async () => {
  fakeOcr.text = new Error("model download failed");
  const res = await request(ctx.app).post("/api/profiles/extract").attach("file", Buffer.from("png-bytes"), { filename: "blurry.jpg", contentType: "image/jpeg" }).expect(422);
  assert.equal(res.body.error.code, "OCR_FAILED");
  assert.equal(ctx.ai.calls.length, 0);
  fakeOcr.text = "";
});

test("TEXT-LAYER documents skip OCR", async () => {
  fakeOcr.calls = 0;
  ctx.ai.queue(goodProfile());
  const res = await request(ctx.app).post("/api/profiles/extract").attach("file", Buffer.from(RESUME_TEXT), { filename: "cv.txt", contentType: "text/plain" }).expect(200);
  assert.equal(res.body.source.extraction, "text_layer");
  assert.equal(fakeOcr.calls, 0);
});
