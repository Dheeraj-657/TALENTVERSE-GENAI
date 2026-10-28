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

// 1. Book data
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

// 4. "Start" buttons that hand control to the React app.
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
