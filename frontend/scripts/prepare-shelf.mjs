// Builds public/landing-pages/complete-shelf-v2.html from the ThreeUI template (MIT, @designcodeio/threeui).
// <CompleteShelfLandingPage> renders that path in an iframe; this script swaps the seven demo books for the
// five TalentVerse volumes and adds a postMessage bridge so "Start" opens the matching React workspace.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("@designcodeio/threeui/package.json"));
const SRC = path.join(pkgDir, "lib-dist/assets/landing-pages/complete-shelf-v2.html");
const OUT = path.resolve("public/landing-pages/complete-shelf-v2.html");

let html = fs.readFileSync(SRC, "utf8");

function replaceOnce(find, replacement) {
  if (!html.includes(find)) throw new Error(`prepare-shelf: template changed, cannot find: ${String(find).slice(0, 60)}`);
  html = html.replace(find, replacement);
}

// Palettes and proportions are the template's own (volumes I, II, IV, V and VII).
const BOOKS = [
  {
    id: "profiles", title: "Profile", roman: "I", discipline: "Resume intelligence",
    note: "A resume or spoken introduction, bound into a structured profile.",
    deck: "Upload a resume, paste it, or record an introduction. TalentVerse extracts skills, experience and education into a validated profile — missing details stay marked as missing, never invented.",
    binding: "Text · PDF · DOCX · audio", format: "Validated skills profile", theme: "profiles table · create / update", motif: "Nested brackets", motifKey: "brackets",
    paletteLabel: "Ultramarine · bone · copper", color: "#182a43", foil: "#c87046",
    palette: { paper: "#171a24", paperDeep: "#10131b", paperPale: "#f1eadf", ink: "#f4eee6", inkSoft: "#b9b4ae", wall: "#171a24", shelf: "#3a2118", shelfDark: "#1c0e0a", light: "#f4d7b9", fill: "#9fb3c9" },
    width: 1.02, height: 1.58, depth: 0.26, chapters: ["Read", "Extract", "Verify"], seed: 11,
  },
  {
    id: "learning-plans", title: "Learning Plan", roman: "II", discipline: "Skill-gap mapping",
    note: "A career goal, mapped into gaps and time-boxed milestones.",
    deck: "State where you want to be. TalentVerse maps the skills the role needs against what you have, ranks the gaps, and lays out ordered milestones with deliverables that fit your timeframe.",
    binding: "Goal text · saved profile", format: "Gap map · milestones", theme: "learning_plans table", motif: "Interlaced paths", motifKey: "paths",
    paletteLabel: "Burnt orange · cream · burgundy", color: "#c24d24", foil: "#efc16d",
    palette: { paper: "#762f1b", paperDeep: "#572113", paperPale: "#ffe4c5", ink: "#fff0df", inkSoft: "#e3bfa8", wall: "#762f1b", shelf: "#402015", shelfDark: "#1d0d08", light: "#ffd19a", fill: "#dc8c6b" },
    width: 1.1, height: 1.46, depth: 0.29, chapters: ["Goal", "Gaps", "Milestones"], seed: 22,
  },
  {
    id: "job-matches", title: "Job Match", roman: "III", discipline: "Role comparison",
    note: "A job description, read closely and held against a profile.",
    deck: "Paste a job description. The AI extracts required and preferred skills; the server then compares them with a saved profile and computes a transparent, reproducible match score.",
    binding: "Job description · profile", format: "Requirements · match score", theme: "job_matches table", motif: "Suspended orbits", motifKey: "orbits",
    paletteLabel: "Cobalt · sky · silver", color: "#1537a1", foil: "#dbe8f1",
    palette: { paper: "#142a80", paperDeep: "#0b1953", paperPale: "#dbe8f1", ink: "#f3f5f2", inkSoft: "#b5c7e9", wall: "#142a80", shelf: "#3b2117", shelfDark: "#1a0d08", light: "#e5edf2", fill: "#5f85dc" },
    width: 1.08, height: 1.68, depth: 0.25, chapters: ["Requirements", "Comparison", "Score"], seed: 44,
  },
  {
    id: "project-briefs", title: "Project Brief", roman: "IV", discipline: "Portfolio design",
    note: "Interests and skills, drafted into a portfolio project.",
    deck: "Tell TalentVerse what you enjoy and what you can build. It drafts one realistic portfolio project: the problem, users, stack, core features, weekly milestones and success criteria.",
    binding: "Interests · skills", format: "Project brief", theme: "project_briefs table", motif: "Connected modules", motifKey: "modules",
    paletteLabel: "Vermilion · plum · blush", color: "#c83222", foil: "#efb0aa",
    palette: { paper: "#a62c21", paperDeep: "#7f1e17", paperPale: "#ffe0d5", ink: "#fff0e8", inkSoft: "#e9bbb2", wall: "#a62c21", shelf: "#432016", shelfDark: "#1f0d08", light: "#ffd1bc", fill: "#d66d66" },
    width: 1, height: 1.48, depth: 0.3, chapters: ["Interests", "Scope", "Milestones"], seed: 55,
  },
  {
    id: "interview-feedback", title: "Interview", roman: "V", discipline: "Practice feedback",
    note: "Practice notes, turned into strengths and next drills.",
    deck: "Paste notes from a mock interview or record a voice reflection. TalentVerse separates evidenced strengths from improvement areas and assigns focused, time-boxed practice tasks.",
    binding: "Notes · voice memo", format: "Strengths · next tasks", theme: "interview_feedback table", motif: "Drafting compass", motifKey: "compass",
    paletteLabel: "Icy cyan · navy · aluminum", color: "#78a7bd", foil: "#e4e7e5",
    palette: { paper: "#7ea5b7", paperDeep: "#5e8699", paperPale: "#e6f0f2", ink: "#102a36", inkSoft: "#274b5a", wall: "#7ea5b7", shelf: "#382017", shelfDark: "#1b0e09", light: "#eef5f2", fill: "#add1df" },
    width: 1.12, height: 1.63, depth: 0.28, chapters: ["Notes", "Strengths", "Next practice"], seed: 77,
  },
];

// How-to-use guide printed on each book's interior pages (pages 3-8).
const COMMON_REVIEW = [
  "Green VALID: every required field was found.",
  "Amber WARNINGS: saved data is fine, but check the notes (e.g. evidence not found in your input).",
  "Red INCOMPLETE: a required field is missing; fill it in via Edit JSON before saving.",
  "Missing values are shown as \"not found\" and are never invented by the AI.",
];
const GUIDES = {
  profiles: {
    input: ["Paste resume text, or attach a PDF / DOCX / TXT file.", "Or press Record audio and introduce yourself.", "Email, phone and profile links are redacted before the AI sees the text."],
    ai: ["Reads the input against a strict JSON schema.", "Extracts name, headline, skills (with evidence), experience, education.", "Invalid output is sent back once for repair, then re-checked."],
    save: ["Press Review & save, then Confirm.", "New candidate: a row is CREATED in the profiles table.", "Same email uploaded again: tick Update to UPDATE it (version +1).", "Contact details are stored masked only."],
    fields: ["full_name *", "headline", "location", "total_experience_years", "summary *", "skills * (name, category, level, evidence)", "experience", "education", "certifications, languages"],
    tips: ["Input must be at least 30 characters.", "Scanned image-only PDFs cannot be read.", "Files up to 10 MB. Images are rejected (415).", "Save a profile first: Job Match needs one."],
  },
  "learning-plans": {
    input: ["Describe your target role and timeframe, e.g. \"Data analyst in 12 weeks\".", "Mention what you already know.", "Optionally pick a saved profile so your skills are used as context."],
    ai: ["Lists the skills the role requires (must-have / nice-to-have).", "Compares them with your current skills to find gaps.", "Builds ordered milestones with objectives, resources and a deliverable."],
    save: ["Press Review & save, then Confirm.", "A row is CREATED in the learning_plans table.", "Warnings appear if milestones exceed your timeframe or skip a high-priority gap."],
    fields: ["target_role *", "timeframe_weeks", "current_skills", "required_skills", "skill_gaps * (level now -> target, priority)", "milestones * (weeks, objectives, deliverable)"],
    tips: ["If no role is named, target_role is left empty and saving is blocked.", "Give a timeframe for a realistic plan.", "Edit milestones in Edit JSON before saving."],
  },
  "job-matches": {
    input: ["Choose a saved profile (required).", "Paste the full job description.", "Your profile is NOT sent to the AI for this step."],
    ai: ["Extracts title, seniority, required and preferred skills.", "The server, not the AI, compares them with the profile.", "Score = 70% required + 20% preferred + 10% experience fit."],
    save: ["Review matched and missing skills and the score.", "Press Review & save, then Confirm.", "A row is CREATED in the job_matches table, linked to the profile."],
    fields: ["job_title *", "company, location", "seniority, employment_type", "min_experience_years", "required_skills *", "preferred_skills", "responsibilities, qualifications"],
    tips: ["No profile selected: 400 PROFILE_REQUIRED.", "Score is reproducible: same input, same number.", "Java and JavaScript are treated as different skills."],
  },
  "project-briefs": {
    input: ["Describe your interests (sports, finance, music...).", "List the skills you have or want to practise.", "Optionally pick a saved profile for context."],
    ai: ["Proposes one realistic solo portfolio project.", "Defines problem, target users, stack and difficulty.", "Adds core and stretch features, weekly milestones and success criteria."],
    save: ["Press Review & save, then Confirm.", "A row is CREATED in the project_briefs table.", "Saved briefs can be edited later; edits are re-validated."],
    fields: ["title *", "tagline", "problem_statement *", "target_users", "difficulty, estimated_weeks", "tech_stack *", "core_features * (3+)", "milestones, success_criteria"],
    tips: ["More specific interests give better briefs.", "Fewer than 3 core features triggers a warning.", "Removing all core features blocks saving (422)."],
  },
  "interview-feedback": {
    input: ["Paste notes from a mock interview, or", "Record a voice reflection with Record audio.", "Audio is transcribed with Whisper; the transcript is shown in the preview."],
    ai: ["Separates strengths (with evidence from your notes) from improvement areas.", "Rates overall readiness, or leaves it empty if notes are too thin.", "Creates practice tasks with duration and due date."],
    save: ["Press Review & save, then Confirm.", "A row is CREATED in the interview_feedback table.", "Warnings show if an improvement area has no practice task."],
    fields: ["role", "interview_type", "overall_readiness", "strengths * (point, evidence)", "improvement_areas * (area, suggestion, priority)", "next_practice_tasks * (task, minutes, due)"],
    tips: ["Write what actually happened, not just a score.", "Evidence not found in your notes is flagged.", "Short notes may leave readiness empty."],
  },
};

// 1. Book data
for (const book of BOOKS) book.guide = { ...GUIDES[book.id], review: COMMON_REVIEW };
const start = html.indexOf("const BOOKS = [");
const end = html.indexOf("\n    ];", start) + "\n    ];".length;
if (start < 0 || end < start) throw new Error("prepare-shelf: BOOKS array not found");
html = html.slice(0, start) + `const BOOKS = ${JSON.stringify(BOOKS, null, 2)};` + html.slice(end);

// 2. Use the template's procedural covers (they print each volume's title) instead of the pre-rendered atlas.
replaceOnce("coverAtlasReady = true;", "coverAtlasReady = false; // TalentVerse: draw titled procedural covers");

// 3. Branding and copy
html = html
  .replaceAll("WORKING VOLUMES", "TALENTVERSE")
  .replaceAll("Working Volumes", "TalentVerse")
  .replace(/<title>[^<]*<\/title>/, "<title>TalentVerse — Skills &amp; Career Intelligence</title>")
  .replace(/(<meta\s+name="description"\s+content=")[^"]*"/, '$1TalentVerse turns resumes, goals, job descriptions and interview notes into validated career intelligence."');
replaceOnce("<span>Seven field guides for making</span>", "<span>Skills &amp; career intelligence</span>");
replaceOnce("<span>Edition 02 · 2026</span>", "<span>Five volumes · AI-assisted</span>");
replaceOnce("Seven tools for making.", "Five tools for your career.");
replaceOnce('aria-label="Seven conceptual hardcovers"', 'aria-label="Five TalentVerse volumes"');
replaceOnce('<span class="counter" id="counter">01 / 07</span>', '<span class="counter" id="counter">01 / 05</span>');
for (const [from, to] of [["Binding", "Input"], ["Format", "Output"], ["Theme", "Saves to"], ["Motif", "Motif"]]) {
  replaceOnce(`<dt>${from}</dt>`, `<dt>${to}</dt>`);
}
html = html.replace(
  /(<div class="fallback__grid"[^>]*>)[\s\S]*?(<\/div>)/,
  (m, open, close) =>
    open + BOOKS.map((b, i) => `<article class="fallback-book" style="--book-color:${b.color};--book-foil:${b.foil};--book-height:${370 + i * 8}px"><span>Volume ${b.roman}</span><strong>${b.title}</strong></article>`).join("") + close
);

// 4. Interior pages: a readable how-to-use guide instead of decorative filler.
//    Drawn at full canvas resolution with bold, high-contrast type.
const INTERIOR_PAGES = `function makeInteriorPageTextures(book) {
      const W = 512;
      const H = 768;
      const inkColor = new THREE.Color(book.color).lerp(new THREE.Color(0x15110d), 0.78);
      const ink = "#" + inkColor.getHexString();
      const accent = new THREE.Color(book.color).lerp(new THREE.Color(0x000000), 0.15);
      const accentHex = "#" + accent.getHexString();
      const g = book.guide;

      function wrap(ctx, text, x, y, maxWidth, lineHeight, maxLines = 12) {
        const words = String(text).split(/\\s+/);
        let line = "";
        let lines = 0;
        for (const word of words) {
          const test = line ? line + " " + word : word;
          if (ctx.measureText(test).width > maxWidth && line) {
            if (lines >= maxLines) return y + lines * lineHeight;
            ctx.fillText(line, x, y + lines * lineHeight);
            line = word;
            lines += 1;
          } else {
            line = test;
          }
        }
        if (line && lines < maxLines) {
          ctx.fillText(line, x, y + lines * lineHeight);
          lines += 1;
        }
        return y + lines * lineHeight;
      }

      function heading(ctx, kicker, title) {
        ctx.fillStyle = accentHex;
        ctx.font = '700 15px Inter, "Helvetica Neue", Arial, sans-serif';
        ctx.letterSpacing = "2px";
        ctx.fillText(kicker, 44, 122);
        ctx.fillStyle = ink;
        ctx.letterSpacing = "0px";
        ctx.font = '600 40px "Iowan Old Style", Baskerville, Georgia, serif';
        const end = wrap(ctx, title, 44, 172, W - 88, 44, 2);
        ctx.fillStyle = accentHex;
        ctx.fillRect(44, end - 18, 64, 4);
        return end + 22;
      }

      function bullets(ctx, items, y, { numbered = false, size = 20 } = {}) {
        ctx.font = '500 ' + size + 'px Inter, "Helvetica Neue", Arial, sans-serif';
        ctx.letterSpacing = "0px";
        const lh = Math.round(size * 1.38);
        items.forEach((item, i) => {
          if (y > H - 90) return;
          ctx.fillStyle = accentHex;
          ctx.font = '700 ' + size + 'px Inter, "Helvetica Neue", Arial, sans-serif';
          ctx.fillText(numbered ? String(i + 1) + "." : "\\u2022", 46, y);
          ctx.fillStyle = ink;
          ctx.font = '500 ' + size + 'px Inter, "Helvetica Neue", Arial, sans-serif';
          y = wrap(ctx, item, 76, y, W - 76 - 40, lh, 5) + 12;
        });
        return y;
      }

      const PAGES = [
        (ctx) => {
          ctx.fillStyle = accentHex;
          ctx.font = '700 15px Inter, "Helvetica Neue", Arial, sans-serif';
          ctx.letterSpacing = "2.4px";
          ctx.fillText("VOLUME " + book.roman + "  \\u00b7  " + book.discipline.toUpperCase(), 44, 150);
          ctx.fillStyle = ink;
          ctx.letterSpacing = "0px";
          ctx.font = '600 ' + (book.title.length > 10 ? 54 : 64) + 'px "Iowan Old Style", Baskerville, Georgia, serif';
          const end = wrap(ctx, book.title, 42, 236, W - 84, 64, 2);
          ctx.fillStyle = accentHex;
          ctx.fillRect(44, end - 30, 72, 5);
          ctx.fillStyle = ink;
          ctx.font = 'italic 500 25px "Iowan Old Style", Baskerville, Georgia, serif';
          wrap(ctx, book.note, 44, end + 30, W - 88, 34, 4);
          ctx.fillStyle = accentHex;
          ctx.font = '700 17px Inter, "Helvetica Neue", Arial, sans-serif';
          ctx.letterSpacing = "2px";
          ctx.fillText("HOW TO USE THIS VOLUME  \\u2192", 44, H - 120);
          ctx.letterSpacing = "0px";
          ctx.fillStyle = ink;
          ctx.font = '500 16px Inter, "Helvetica Neue", Arial, sans-serif';
          ctx.fillText("Turn the page with the arrows below.", 44, H - 90);
        },
        (ctx) => {
          let y = heading(ctx, "01  \\u00b7  OVERVIEW", "What it does");
          ctx.fillStyle = ink;
          ctx.font = '500 21px Inter, "Helvetica Neue", Arial, sans-serif';
          y = wrap(ctx, book.deck, 44, y + 6, W - 88, 30, 9) + 18;
          const rows = [["INPUT", book.binding], ["OUTPUT", book.format], ["SAVES TO", book.theme]];
          for (const [k, v] of rows) {
            ctx.fillStyle = accentHex;
            ctx.font = '700 13px Inter, "Helvetica Neue", Arial, sans-serif';
            ctx.letterSpacing = "1.8px";
            ctx.fillText(k, 44, y);
            ctx.letterSpacing = "0px";
            ctx.fillStyle = ink;
            ctx.font = '600 19px Inter, "Helvetica Neue", Arial, sans-serif';
            y = wrap(ctx, v, 44, y + 26, W - 88, 26, 2) + 14;
          }
        },
        (ctx) => bullets(ctx, g.input, heading(ctx, "STEP 1", "Give your input"), { numbered: true }),
        (ctx) => bullets(ctx, g.ai, heading(ctx, "STEP 2", "AI extracts & validates"), { numbered: true }),
        (ctx) => bullets(ctx, g.review, heading(ctx, "STEP 3", "Review the preview"), { size: 19 }),
        (ctx) => bullets(ctx, g.save, heading(ctx, "STEP 4", "Confirm & save"), { numbered: true }),
        (ctx) => {
          const y = heading(ctx, "REFERENCE", "Fields extracted");
          bullets(ctx, g.fields, y, { size: 19 });
          ctx.fillStyle = accentHex;
          ctx.font = '600 15px Inter, "Helvetica Neue", Arial, sans-serif';
          ctx.fillText("* required before saving", 44, H - 74);
        },
        (ctx) => {
          const y = heading(ctx, "TIPS", "Tips & errors");
          bullets(ctx, g.tips, y, { size: 19 });
          ctx.fillStyle = accentHex;
          ctx.font = '700 17px Inter, "Helvetica Neue", Arial, sans-serif';
          ctx.letterSpacing = "1.6px";
          ctx.fillText("PRESS \\u201cUSE THIS TOOL \\u2192\\u201d TO START", 44, H - 80);
          ctx.letterSpacing = "0px";
        },
      ];

      return PAGES.map((draw, pageIndex) => {
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        const random = seededRandom(hashSeed(book.id + "-leaf-" + pageIndex) + book.seed);
        drawPaperSurface(ctx, W, H, random);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.8;
        ctx.font = '600 12px Inter, "Helvetica Neue", Arial, sans-serif';
        ctx.letterSpacing = "1.8px";
        ctx.fillText("TALENTVERSE  /  " + book.roman, 44, 48);
        ctx.textAlign = "right";
        ctx.fillText(pad(pageIndex + 1) + " / 08", W - 44, 48);
        ctx.textAlign = "left";
        ctx.fillRect(44, 62, W - 88, 1.5);
        ctx.fillRect(44, H - 44, W - 88, 1.5);
        ctx.globalAlpha = 1;
        ctx.letterSpacing = "0px";

        draw(ctx);

        const texture = configureCanvasTexture(new THREE.CanvasTexture(canvas), { anisotropy: 16 });
        texture.name = book.id + "-interior-page-" + (pageIndex + 1);
        return texture;
      });
    }

    `;
const pagesStart = html.indexOf("function makeInteriorPageTextures(book) {");
const pagesEnd = html.indexOf("function makeContactShadowTexture()");
if (pagesStart < 0 || pagesEnd < pagesStart) throw new Error("prepare-shelf: interior page renderer not found");
html = html.slice(0, pagesStart) + INTERIOR_PAGES + html.slice(pagesEnd);

html = html.replace(
  /function getSpreadLabels\(book\) \{[\s\S]*?\n    \}/,
  `function getSpreadLabels(book) {
      return ["How to use", "Overview · Step 1", "Step 2 · Step 3", "Step 4 · Fields", "Tips & errors"];
    }`
);

// 5. "Start" buttons that hand control to the React app.
replaceOnce('<button class="text-button" id="inspect" type="button">Open</button>', '<button class="text-button" id="inspect" type="button">Open</button>\n        <button class="text-button tv-start" id="tv-start-browse" type="button">Start</button>');
replaceOnce('<div class="detail-buttons">', '<div class="detail-buttons">\n          <button class="text-button reset-button tv-start" id="tv-start-detail" type="button">Use this tool →</button>');

const bridge = `
    // TalentVerse bridge: tell the parent React app which volume to open.
    for (const button of document.querySelectorAll(".tv-start")) {
      button.addEventListener("click", () => {
        window.parent.postMessage({ type: "talentverse:open", feature: BOOKS[selectedIndex].id }, window.location.origin);
      });
    }
    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== "talentverse:select") return;
      const index = BOOKS.findIndex((b) => b.id === event.data.feature);
      if (index >= 0) updateSelection(index, true);
    });
  `;
const lastScript = html.lastIndexOf("</script>");
html = html.slice(0, lastScript) + bridge + html.slice(lastScript);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`[prepare-shelf] wrote ${path.relative(process.cwd(), OUT)} (${BOOKS.length} volumes)`);
