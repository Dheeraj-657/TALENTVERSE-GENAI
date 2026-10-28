import {
  profileSchema,
  learningPlanSchema,
  jobRequirementsSchema,
  projectBriefSchema,
  interviewFeedbackSchema,
} from "../schemas/features.js";
import { compareProfileToJob } from "./matching.js";

// Words that appear in the source text, used to check that "evidence" quotes are grounded and not invented.
function tokenSet(text) {
  return new Set(String(text || "").toLowerCase().match(/[a-z0-9+#]+/g) || []);
}

function isGrounded(phrase, sourceTokens) {
  const words = String(phrase || "").toLowerCase().match(/[a-z0-9+#]+/g) || [];
  if (!words.length) return true;
  const hits = words.filter((w) => sourceTokens.has(w)).length;
  return hits / words.length >= 0.6;
}

function evidenceWarnings(items, field, label, sourceText) {
  const tokens = tokenSet(sourceText);
  return items
    .map((item, i) => (item[field] && !isGrounded(item[field], tokens) ? `${label}[${i}] evidence "${item[field]}" was not found in the input.` : null))
    .filter(Boolean);
}

// The registry drives the generic extract -> preview -> confirm pipeline for all five features.
// required: fields that must be present before the record may be saved.
// profileContext: whether a saved profile is used as AI context ("optional") or must be supplied ("required").
export const FEATURES = {
  profiles: {
    key: "profiles",
    label: "Skills & experience profile",
    promptKey: "profile",
    schema: profileSchema,
    required: ["full_name", "skills", "summary"],
    profileContext: "none",
    postProcess({ data, sourceText }) {
      const warnings = evidenceWarnings(data.skills, "evidence", "skills", sourceText);
      const seen = new Set();
      data.skills = data.skills.filter((s) => {
        const k = s.name.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      for (const e of data.experience) {
        if (e.is_current && e.end_date) warnings.push(`experience "${e.title}" is marked current but has an end date.`);
      }
      return { warnings };
    },
  },

  "learning-plans": {
    key: "learning-plans",
    label: "Skill-gap map & learning plan",
    promptKey: "learningPlan",
    schema: learningPlanSchema,
    required: ["target_role", "skill_gaps", "milestones"],
    profileContext: "optional",
    postProcess({ data }) {
      const warnings = [];
      data.milestones.sort((a, b) => a.order - b.order);
      const totalWeeks = data.milestones.reduce((a, m) => a + m.duration_weeks, 0);
      if (data.timeframe_weeks && totalWeeks > data.timeframe_weeks) {
        warnings.push(`Milestones total ${totalWeeks} weeks, which exceeds the ${data.timeframe_weeks}-week timeframe.`);
      }
      const covered = new Set(data.milestones.flatMap((m) => m.skills_covered.map((s) => s.toLowerCase())));
      for (const g of data.skill_gaps) {
        if (g.priority === "high" && !covered.has(g.skill.toLowerCase())) warnings.push(`High-priority gap "${g.skill}" is not covered by any milestone.`);
      }
      return { warnings, extras: { total_weeks: totalWeeks } };
    },
  },

  "job-matches": {
    key: "job-matches",
    label: "Job requirements vs candidate",
    promptKey: "jobRequirements",
    schema: jobRequirementsSchema,
    required: ["job_title", "required_skills"],
    profileContext: "required",
    // The profile is NOT sent to the AI for this feature: extraction stays independent of the candidate.
    sendProfileToAi: false,
    postProcess({ data, profile }) {
      const comparison = compareProfileToJob(profile, data);
      const warnings = [];
      if (comparison.match_score === null) warnings.push("Not enough requirement data to compute a match score.");
      return { warnings, extras: { comparison } };
    },
  },

  "project-briefs": {
    key: "project-briefs",
    label: "Portfolio project brief",
    promptKey: "projectBrief",
    schema: projectBriefSchema,
    required: ["title", "problem_statement", "core_features", "tech_stack"],
    profileContext: "optional",
    postProcess({ data }) {
      const warnings = [];
      if (data.core_features.length < 3) warnings.push("Fewer than 3 core features were generated.");
      if (data.milestones.some((m) => m.week > data.estimated_weeks)) warnings.push("A milestone falls after the estimated duration.");
      return { warnings };
    },
  },

  "interview-feedback": {
    key: "interview-feedback",
    label: "Interview practice feedback",
    promptKey: "interviewFeedback",
    schema: interviewFeedbackSchema,
    required: ["strengths", "improvement_areas", "next_practice_tasks"],
    profileContext: "optional",
    postProcess({ data, sourceText }) {
      const warnings = evidenceWarnings(data.strengths, "evidence", "strengths", sourceText);
      const focus = data.next_practice_tasks.map((t) => t.focus_area.toLowerCase());
      for (const a of data.improvement_areas) {
        const area = a.area.toLowerCase();
        if (!focus.some((f) => f.includes(area) || area.includes(f))) warnings.push(`Improvement area "${a.area}" has no matching practice task.`);
      }
      return { warnings };
    },
  },
};

export function getFeature(key) {
  return FEATURES[key] || null;
}
