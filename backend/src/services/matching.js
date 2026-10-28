// Deterministic candidate <-> job comparison. The AI only extracts requirements;
// the score is computed here so it is reproducible and explainable.

const ALIASES = {
  js: "javascript",
  ts: "typescript",
  node: "nodejs",
  "node js": "nodejs",
  reactjs: "react",
  "react js": "react",
  "vue js": "vue",
  vuejs: "vue",
  "next js": "nextjs",
  "express js": "express",
  expressjs: "express",
  mongo: "mongodb",
  postgres: "postgresql",
  psql: "postgresql",
  k8s: "kubernetes",
  ml: "machine learning",
  ai: "artificial intelligence",
  "c sharp": "c#",
  golang: "go",
  py: "python",
  "rest api": "rest",
  "restful apis": "rest",
  "rest apis": "rest",
  aws: "amazon web services",
  gcp: "google cloud",
};

export function normalizeSkill(name) {
  let s = String(name || "")
    .toLowerCase()
    .replace(/\.js\b/g, "js")
    .replace(/[^a-z0-9+#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ALIASES[s] || s;
}

function hasSkill(candidateSet, skill) {
  const target = normalizeSkill(skill);
  if (!target) return false;
  if (candidateSet.has(target)) return true;
  // Loose match for multi-word skills ("react" vs "react native" is NOT a match, but "sql" vs "postgresql" counts as related).
  for (const c of candidateSet) {
    if (c.length > 2 && target.length > 2 && (c.includes(` ${target}`) || target.includes(` ${c}`) || c.endsWith(target) || target.endsWith(c))) return true;
  }
  return false;
}

export function compareProfileToJob(profile, job) {
  const candidateSet = new Set((profile.skills || []).map((s) => normalizeSkill(s.name)).filter(Boolean));

  const required = job.required_skills || [];
  const preferred = job.preferred_skills || [];
  const matchedRequired = required.filter((s) => hasSkill(candidateSet, s));
  const missingRequired = required.filter((s) => !hasSkill(candidateSet, s));
  const matchedPreferred = preferred.filter((s) => hasSkill(candidateSet, s));
  const missingPreferred = preferred.filter((s) => !hasSkill(candidateSet, s));

  const reqCoverage = required.length ? matchedRequired.length / required.length : null;
  const prefCoverage = preferred.length ? matchedPreferred.length / preferred.length : null;

  let experienceFit = null;
  if (job.min_experience_years != null && profile.total_experience_years != null) {
    experienceFit = Math.min(profile.total_experience_years / Math.max(job.min_experience_years, 0.5), 1);
  }

  // Weighted score over the components we actually have data for (missing components are not guessed).
  const parts = [
    [reqCoverage, 0.7],
    [prefCoverage, 0.2],
    [experienceFit, 0.1],
  ].filter(([v]) => v !== null);
  const weightSum = parts.reduce((a, [, w]) => a + w, 0);
  const score = weightSum ? Math.round((parts.reduce((a, [v, w]) => a + v * w, 0) / weightSum) * 100) : null;

  let verdict = "insufficient_data";
  if (score !== null) verdict = score >= 75 ? "strong_match" : score >= 50 ? "partial_match" : "weak_match";

  return {
    match_score: score,
    verdict,
    required_coverage: reqCoverage === null ? null : Math.round(reqCoverage * 100),
    preferred_coverage: prefCoverage === null ? null : Math.round(prefCoverage * 100),
    experience_fit: experienceFit === null ? null : Math.round(experienceFit * 100),
    matched_required: matchedRequired,
    missing_required: missingRequired,
    matched_preferred: matchedPreferred,
    missing_preferred: missingPreferred,
  };
}
