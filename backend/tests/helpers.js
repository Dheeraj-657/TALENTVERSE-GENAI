import { connectDB, disconnectDB, getDB } from "../src/config/db.js";
import { createApp } from "../src/app.js";

// Fake Groq client: returns queued JSON responses and records every prompt it receives.
export function fakeAi() {
  const queue = [];
  const calls = [];
  return {
    calls,
    queue(...responses) {
      queue.push(...responses);
    },
    chat: {
      completions: {
        async create(params) {
          calls.push(params);
          if (!queue.length) throw new Error("fakeAi: no queued response");
          const next = queue.shift();
          if (next instanceof Error) throw next;
          const content = typeof next === "string" ? next : JSON.stringify(next);
          return { choices: [{ message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 50 } };
        },
      },
    },
    audio: {
      transcriptions: {
        async create() {
          return { text: fakeAi.transcript };
        },
      },
    },
  };
}
fakeAi.transcript = "";

// Fake OCR: returns fakeOcr.text, or throws if it is an Error.
export const fakeOcr = {
  text: "",
  calls: 0,
  async pdf() {
    return { text: await fakeOcr.images() };
  },
  async images() {
    fakeOcr.calls += 1;
    if (fakeOcr.text instanceof Error) throw fakeOcr.text;
    return fakeOcr.text;
  },
};

// Every test run uses a fresh in-memory SQLite database: fast, isolated, no files left behind.
export async function setup() {
  connectDB(":memory:");
  const ai = fakeAi();
  const app = createApp({ aiClient: ai, ocr: fakeOcr });
  return {
    app,
    ai,
    async teardown() {
      disconnectDB();
    },
    async reset() {
      getDB().exec("DELETE FROM job_matches; DELETE FROM learning_plans; DELETE FROM project_briefs; DELETE FROM interview_feedback; DELETE FROM profiles; DELETE FROM drafts;");
    },
  };
}

export const RESUME_TEXT = `Priya Sharma
Email: priya.sharma@example.com | Phone: +91 98765 43210 | linkedin.com/in/priya
Full-stack developer with 3 years of experience.
Experience: Software Engineer at Acme Corp (2022-01 to present). Built React dashboards and Node.js REST APIs with MongoDB.
Skills: JavaScript, React, Node.js, MongoDB, Git, communication.
Education: B.Tech Computer Science, VIT University, 2021.`;

export const goodProfile = (overrides = {}) => ({
  full_name: "Priya Sharma",
  headline: "Full-stack developer",
  location: null,
  total_experience_years: 3,
  summary: "Full-stack developer with 3 years building React and Node.js applications.",
  skills: [
    { name: "JavaScript", category: "technical", proficiency: "advanced", years: 3, evidence: "Skills: JavaScript" },
    { name: "React", category: "technical", proficiency: null, years: null, evidence: "Built React dashboards" },
    { name: "Node.js", category: "technical", proficiency: null, years: null, evidence: "Node.js REST APIs" },
    { name: "MongoDB", category: "tool", proficiency: null, years: null, evidence: "with MongoDB" },
  ],
  experience: [{ title: "Software Engineer", company: "Acme Corp", start_date: "2022-01", end_date: null, is_current: true, highlights: ["Built React dashboards"] }],
  education: [{ degree: "B.Tech", institution: "VIT University", field: "Computer Science", year: 2021 }],
  certifications: [],
  languages: [],
  missing_fields: ["location"],
  ...overrides,
});
