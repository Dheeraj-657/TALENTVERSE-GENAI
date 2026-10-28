// Presentation config for the five TalentVerse features ("volumes" on the shelf).
export const FEATURES = [
  {
    key: "profiles",
    roman: "I",
    title: "Profile",
    label: "Skills & experience profile",
    note: "A resume or spoken introduction, bound into a structured profile.",
    inputHint: "Paste a resume, upload a PDF / DOCX, or record an audio introduction.",
    color: "#182a43",
    sample: `Arjun Mehta | arjun.m@gmail.com | +91 91234 56789
Final-year B.Tech CSE student at SRM Institute (2026). Backend intern at TechNova (Jun 2025 - Aug 2025): built REST APIs in Express and Node.js with PostgreSQL.
Projects: real-time chat app with React and Socket.io. Skills: Python, JavaScript, SQL, Git, Docker basics. Languages: English, Hindi.`,
    titleOf: (r) => r.full_name,
  },
  {
    key: "learning-plans",
    roman: "II",
    title: "Learning Plan",
    label: "Skill-gap map & learning plan",
    note: "A career goal, mapped into gaps and time-boxed milestones.",
    inputHint: "Describe your goal, timeframe and what you know. Optionally use a saved profile.",
    color: "#c24d24",
    sample: "I know HTML, CSS and basic JavaScript. I want to become a full-stack MERN developer in 12 weeks so I can apply for internships.",
    titleOf: (r) => r.target_role,
  },
  {
    key: "job-matches",
    roman: "III",
    title: "Job Match",
    label: "Job requirements vs candidate",
    note: "A job description, read closely and held against a profile.",
    inputHint: "Paste a job description and choose the profile to compare.",
    color: "#1537a1",
    sample: "CloudKart (Bengaluru) is hiring a Junior Backend Developer. Required: Node.js, Express, SQL, REST APIs, Git. Nice to have: Docker, AWS. 0-1 years of experience. Responsibilities: build and maintain APIs, write tests, review code.",
    titleOf: (r) => `${r.job_title}${r.comparison?.match_score != null ? ` · ${r.comparison.match_score}%` : ""}`,
  },
  {
    key: "project-briefs",
    roman: "IV",
    title: "Project Brief",
    label: "Portfolio project brief",
    note: "Interests and skills, drafted into a portfolio project.",
    inputHint: "Tell us what you enjoy and which skills you have.",
    color: "#c83222",
    sample: "I love cricket and data. I know Python, pandas and a bit of React. Suggest a portfolio project that would impress data/analytics recruiters.",
    titleOf: (r) => r.title,
  },
  {
    key: "interview-feedback",
    roman: "V",
    title: "Interview Notes",
    label: "Interview practice feedback",
    note: "Practice notes, turned into strengths and next drills.",
    inputHint: "Paste practice notes or upload a voice memo of your reflection.",
    color: "#78a7bd",
    sample: "Mock technical interview for a backend developer role. I explained REST and HTTP status codes clearly and gave a good example from my internship. I struggled with SQL joins and couldn't write a GROUP BY query. I spoke too fast when nervous and didn't ask clarifying questions.",
    titleOf: (r) => r.role || "Practice session",
  },
];

export const featureByKey = Object.fromEntries(FEATURES.map((f) => [f.key, f]));
