# TalentVerse — Skills & Career Intelligence

A GenAI app that turns unstructured career input (resumes, audio introductions, goals, job descriptions,
interview notes) into **schema-validated** structured data, previews it, and saves it to a database only
after the user confirms.

| Volume | Input | Output | Table |
|---|---|---|---|
| I · Profile | resume text / PDF / DOCX / audio | skills & experience profile | `profiles` |
| II · Learning Plan | career goal (+ profile) | skill-gap map + milestones | `learning_plans` |
| III · Job Match | job description + profile | requirements + computed match score | `job_matches` |
| IV · Project Brief | interests + skills | portfolio project brief | `project_briefs` |
| V · Interview | practice notes / voice memo | strengths, improvements, next tasks | `interview_feedback` |

## Stack
- **Frontend:** React 18 + Vite, ThreeUI `CompleteShelfLandingPage` (Three.js) template
- **Backend:** Node.js + Express 5, Zod schemas, Groq (`openai/gpt-oss-120b`, Whisper for audio)
- **Database:** SQLite (`node:sqlite`)

## Flow
`input → text extraction / transcription → PII redaction → schema-guided prompt → JSON → Zod validation
(1 repair retry) → required-field + grounding checks → preview (draft) → user confirms → INSERT / UPDATE`

## Run locally
```bash
# backend (needs GROQ_API_KEY in backend/.env or ./.env)
cd backend && npm install && npm start        # http://localhost:5000  (test console at /demo)
npm test                                        # 21 automated tests

# frontend
cd frontend && npm install && npm run dev      # http://localhost:5173
```

## API
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/:feature/extract` | input → validated preview (draft, not saved) |
| POST | `/api/:feature/confirm` | save draft: `mode: "create"` or `"update"` + `target_id` |
| GET | `/api/:feature`, `/api/:feature/:id` | list / read |
| PUT | `/api/:feature/:id` | edit (re-validated) |
| DELETE | `/api/:feature/:id?confirm=true` | delete (explicit confirmation) |

UI template: ThreeUI Community (MIT) — see `ui-template/SKILL.md`.
