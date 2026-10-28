// SQLite schema. Scalar fields that are filtered/sorted on are real columns;
// nested lists (skills, milestones, ...) are stored as JSON text, validated by Zod before every write.
export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS profiles (
  id                      TEXT PRIMARY KEY,
  full_name               TEXT NOT NULL,
  headline                TEXT,
  location                TEXT,
  total_experience_years  REAL CHECK (total_experience_years IS NULL OR total_experience_years BETWEEN 0 AND 60),
  summary                 TEXT NOT NULL,
  email_masked            TEXT,
  email_hash              TEXT,
  phone_masked            TEXT,
  links_count             INTEGER DEFAULT 0,
  skills                  TEXT NOT NULL CHECK (json_valid(skills) AND json_array_length(skills) > 0),
  experience              TEXT NOT NULL DEFAULT '[]',
  education               TEXT NOT NULL DEFAULT '[]',
  certifications          TEXT NOT NULL DEFAULT '[]',
  languages               TEXT NOT NULL DEFAULT '[]',
  source                  TEXT NOT NULL,
  validation              TEXT NOT NULL,
  ai                      TEXT,
  version                 INTEGER NOT NULL DEFAULT 1,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profiles_email_hash ON profiles(email_hash);

CREATE TABLE IF NOT EXISTS learning_plans (
  id               TEXT PRIMARY KEY,
  profile_id       TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  goal_text        TEXT,
  target_role      TEXT NOT NULL,
  timeframe_weeks  INTEGER,
  total_weeks      INTEGER,
  current_skills   TEXT NOT NULL DEFAULT '[]',
  required_skills  TEXT NOT NULL DEFAULT '[]',
  skill_gaps       TEXT NOT NULL DEFAULT '[]',
  milestones       TEXT NOT NULL DEFAULT '[]',
  source           TEXT NOT NULL,
  validation       TEXT NOT NULL,
  ai               TEXT,
  version          INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_matches (
  id                    TEXT PRIMARY KEY,
  profile_id            TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_title             TEXT NOT NULL,
  company               TEXT,
  seniority             TEXT,
  employment_type       TEXT,
  location              TEXT,
  min_experience_years  REAL,
  match_score           INTEGER,
  required_skills       TEXT NOT NULL DEFAULT '[]',
  preferred_skills      TEXT NOT NULL DEFAULT '[]',
  responsibilities      TEXT NOT NULL DEFAULT '[]',
  qualifications        TEXT NOT NULL DEFAULT '[]',
  comparison            TEXT,
  source                TEXT NOT NULL,
  validation            TEXT NOT NULL,
  ai                    TEXT,
  version               INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_briefs (
  id                   TEXT PRIMARY KEY,
  profile_id           TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  interests_text       TEXT,
  title                TEXT NOT NULL,
  tagline              TEXT,
  problem_statement    TEXT,
  target_users         TEXT,
  difficulty           TEXT,
  estimated_weeks      INTEGER,
  tech_stack           TEXT NOT NULL DEFAULT '[]',
  core_features        TEXT NOT NULL DEFAULT '[]',
  stretch_features     TEXT NOT NULL DEFAULT '[]',
  skills_demonstrated  TEXT NOT NULL DEFAULT '[]',
  milestones           TEXT NOT NULL DEFAULT '[]',
  success_criteria     TEXT NOT NULL DEFAULT '[]',
  source               TEXT NOT NULL,
  validation           TEXT NOT NULL,
  ai                   TEXT,
  version              INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interview_feedback (
  id                   TEXT PRIMARY KEY,
  profile_id           TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  role                 TEXT,
  interview_type       TEXT,
  overall_readiness    TEXT,
  strengths            TEXT NOT NULL DEFAULT '[]',
  improvement_areas    TEXT NOT NULL DEFAULT '[]',
  next_practice_tasks  TEXT NOT NULL DEFAULT '[]',
  source               TEXT NOT NULL,
  validation           TEXT NOT NULL,
  ai                   TEXT,
  version              INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

-- AI previews awaiting user confirmation. Expire after 1 hour.
CREATE TABLE IF NOT EXISTS drafts (
  id             TEXT PRIMARY KEY,
  feature        TEXT NOT NULL,
  data           TEXT NOT NULL,
  extras         TEXT,
  profile_id     TEXT,
  source         TEXT,
  contact        TEXT,
  input_excerpt  TEXT,
  ai             TEXT,
  created_at     TEXT NOT NULL,
  expires_at     TEXT NOT NULL
);
`;
