import { z } from "zod";
import { nstr, str, nint, strList, missingFields, PROFICIENCY, LEVEL, PRIORITY } from "./common.js";

// ---------- 1. Resume / audio intro -> skills & experience profile ----------
export const profileSchema = z.object({
  full_name: nstr("Candidate's full name exactly as written, or null if absent."),
  headline: nstr("Short professional headline, e.g. 'Full-stack developer', or null."),
  location: nstr("City / country if stated, else null."),
  total_experience_years: z.number().min(0).max(60).nullable().describe("Total years of professional experience if stated or clearly computable from dates, else null."),
  summary: nstr("2-3 sentence factual summary built only from the input."),
  skills: z
    .array(
      z.object({
        name: str("Skill name, e.g. 'React'."),
        category: z.enum(["technical", "tool", "soft", "language", "domain"]).describe("Skill category."),
        proficiency: z.enum(PROFICIENCY).nullable().describe("Only if the input supports it, else null."),
        years: z.number().min(0).max(60).nullable().describe("Years using the skill if stated, else null."),
        evidence: nstr("Short phrase copied from the input that shows this skill."),
      })
    )
    .describe("Every skill explicitly mentioned or clearly demonstrated."),
  experience: z
    .array(
      z.object({
        title: str("Job title / role."),
        company: nstr("Organisation name, or null."),
        start_date: nstr("YYYY-MM or YYYY, or null."),
        end_date: nstr("YYYY-MM or YYYY, null if current or unknown."),
        is_current: z.boolean().describe("True only if the input says this role is ongoing."),
        highlights: strList("Key achievements / responsibilities."),
      })
    )
    .describe("Work experience, internships, or significant roles."),
  education: z.array(
    z.object({
      degree: str("Degree or qualification."),
      institution: nstr("Institution name, or null."),
      field: nstr("Field of study, or null."),
      year: nint("Graduation year, or null.", 1950, 2100),
    })
  ),
  certifications: strList("Certifications listed."),
  languages: strList("Spoken languages listed."),
  missing_fields: missingFields,
});

// ---------- 2. Career goal -> skill-gap map + milestone learning plan ----------
export const learningPlanSchema = z.object({
  target_role: nstr("Role the user wants to reach, or null if the goal does not name one."),
  timeframe_weeks: nint("Timeframe in weeks if the user gave one, else null.", 1, 260),
  current_skills: z
    .array(z.object({ name: str("Skill name."), proficiency: z.enum(PROFICIENCY).nullable() }))
    .describe("Skills the user already has according to the input or supplied profile."),
  required_skills: z
    .array(
      z.object({
        name: str("Skill needed for the target role."),
        required_proficiency: z.enum(PROFICIENCY),
        importance: z.enum(["must_have", "nice_to_have"]),
      })
    )
    .describe("Skills typically required for the target role."),
  skill_gaps: z
    .array(
      z.object({
        skill: str("Skill name."),
        current_level: z.enum(LEVEL),
        target_level: z.enum(PROFICIENCY),
        priority: z.enum(PRIORITY),
        reason: str("Why this gap matters for the goal."),
      })
    )
    .describe("Required skills where current level is below target."),
  milestones: z
    .array(
      z.object({
        order: z.number().int().min(1),
        title: str("Milestone name."),
        duration_weeks: z.number().int().min(1).max(52),
        objectives: strList("Concrete learning objectives."),
        resources: strList("Resource types or well-known free resources."),
        deliverable: str("Tangible output proving the milestone is done."),
        skills_covered: strList("Gap skills addressed by this milestone."),
      })
    )
    .describe("Ordered, time-boxed learning milestones."),
  missing_fields: missingFields,
});

// ---------- 3. Job description -> structured requirements (comparison is done in code) ----------
export const jobRequirementsSchema = z.object({
  job_title: nstr("Job title from the description, or null."),
  company: nstr("Company name, or null."),
  seniority: z.enum(["intern", "junior", "mid", "senior", "lead"]).nullable(),
  employment_type: z.enum(["full_time", "part_time", "contract", "internship"]).nullable(),
  location: nstr("Location / remote policy, or null."),
  min_experience_years: z.number().min(0).max(30).nullable().describe("Minimum years required if stated, else null."),
  required_skills: strList("Skills listed as required / must-have."),
  preferred_skills: strList("Skills listed as preferred / nice-to-have / bonus."),
  responsibilities: strList("Main responsibilities."),
  qualifications: strList("Degrees, certifications or other qualifications."),
  missing_fields: missingFields,
});

// ---------- 4. Interests + skills -> portfolio project brief ----------
export const projectBriefSchema = z.object({
  title: str("Project name."),
  tagline: nstr("One-line pitch."),
  problem_statement: str("The real-world problem the project solves."),
  target_users: str("Who would use it."),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimated_weeks: z.number().int().min(1).max(26),
  tech_stack: z.array(z.object({ name: str("Technology."), purpose: str("What it is used for.") })),
  core_features: strList("Must-build features (at least 3)."),
  stretch_features: strList("Optional extensions."),
  skills_demonstrated: strList("Skills a recruiter would see from this project."),
  milestones: z.array(z.object({ week: z.number().int().min(1), goal: str("What is done by this week.") })),
  success_criteria: strList("Measurable signs the project is complete."),
  missing_fields: missingFields,
});

// ---------- 5. Interview practice notes -> strengths / improvements / next tasks ----------
export const interviewFeedbackSchema = z.object({
  role: nstr("Role being practised for, or null."),
  interview_type: z.enum(["technical", "behavioral", "hr", "system_design", "mixed"]).nullable(),
  overall_readiness: z.enum(["not_ready", "developing", "ready", "strong"]).nullable().describe("Null if the notes are too thin to judge."),
  strengths: z.array(
    z.object({
      point: str("Strength observed."),
      evidence: nstr("Phrase from the notes that supports it."),
    })
  ),
  improvement_areas: z.array(
    z.object({
      area: str("Area to improve."),
      observation: str("What happened in the notes."),
      suggestion: str("Specific way to improve."),
      priority: z.enum(PRIORITY),
    })
  ),
  next_practice_tasks: z.array(
    z.object({
      task: str("Concrete practice activity."),
      focus_area: str("Improvement area it targets."),
      duration_minutes: z.number().int().min(5).max(480),
      due_in_days: nint("Suggested days from now, or null.", 0, 90),
    })
  ),
  missing_fields: missingFields,
});
