// lib/analysis.js  (shared by api/analyze-resume.js and api/upload-resume.js)
// Scoring: Required 75% + Preferred 25%. An empty list counts as full coverage.
"use strict";

const REQ_WEIGHT = 0.75;
const PREF_WEIGHT = 0.25;

// variant -> canonical skill. Add more as needed.
const ALIASES = {
  js: "javascript", "java script": "javascript", ecmascript: "javascript",
  ts: "typescript",
  node: "node.js", nodejs: "node.js", "node js": "node.js",
  reactjs: "react", "react.js": "react",
  postgres: "postgresql", psql: "postgresql",
  golang: "go",
  "c sharp": "c#",
  py: "python",
  "amazon web services": "aws",
  "ms excel": "excel", "microsoft excel": "excel",
  "machine learning": "ml",
  "structured query language": "sql",
  github: "git",
};

// canonical -> every spelling that should count (built once)
const VARIANTS = {};
for (const [variant, canon] of Object.entries(ALIASES)) {
  (VARIANTS[canon] = VARIANTS[canon] || new Set([canon])).add(variant);
}

function normalize(skill) {
  const s = String(skill).toLowerCase().trim().replace(/\s+/g, " ");
  return ALIASES[s] || s;
}

// Accepts an array, a JSON-array string, or "a, b, c" and returns a clean array of strings.
function toList(value) {
  if (value == null) return [];
  let arr = value;
  if (typeof value === "string") {
    const t = value.trim();
    if (t.startsWith("[")) {
      try { arr = JSON.parse(t); } catch (_) { arr = t.split(/[,;\n]/); }
    } else {
      arr = t.split(/[,;\n]/);
    }
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const label = String(item).trim();
    const key = normalize(label);
    if (label && !seen.has(key)) { seen.add(key); out.push(label); }
  }
  return out;
}

function scoreFrom(reqList, prefList, matchedRequired, matchedPreferred) {
  const score = Math.round(
    100 *
      (REQ_WEIGHT * (reqList.length ? matchedRequired.length / reqList.length : 1) +
        PREF_WEIGHT * (prefList.length ? matchedPreferred.length / prefList.length : 1))
  );
  return {
    score,
    requiredTotal: reqList.length,
    preferredTotal: prefList.length,
    matchedRequired,
    missingRequired: reqList.filter((s) => !matchedRequired.includes(s)),
    matchedPreferred,
    missingPreferred: prefList.filter((s) => !matchedPreferred.includes(s)),
  };
}

// Manual flow: skills the student typed in.
function match(req, pref, skills) {
  const reqList = toList(req);
  const prefList = toList(pref);
  const have = new Set(toList(skills).map(normalize));
  return scoreFrom(
    reqList,
    prefList,
    reqList.filter((s) => have.has(normalize(s))),
    prefList.filter((s) => have.has(normalize(s)))
  );
}

// ---- Résumé text flow: whole-term matching ---------------------------------
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// "Java" must not match inside "JavaScript"; "C" must not match "C++" or "C#".
function termRegex(term) {
  const body = escapeRegExp(term).replace(/ /g, "[\\s\\-]+");
  return new RegExp(`(?<![A-Za-z0-9_+#])${body}(?![A-Za-z0-9_+#])`, "i");
}

function skillInText(skill, text) {
  const canon = normalize(skill);
  const spellings = new Set([skill.toLowerCase().trim(), canon, ...(VARIANTS[canon] || [])]);
  for (const s of spellings) {
    if (s && termRegex(s).test(text)) return true;
  }
  return false;
}

function matchText(req, pref, text) {
  const reqList = toList(req);
  const prefList = toList(pref);
  const t = String(text || "");
  return scoreFrom(
    reqList,
    prefList,
    reqList.filter((s) => skillInText(s, t)),
    prefList.filter((s) => skillInText(s, t))
  );
}

// ---- Feedback ---------------------------------------------------------------
const TIPS = {
  javascript: "If you've used JavaScript, add a project that shows it, such as a small interactive web app with a link to the code.",
  python: "Add a Python project or script (data cleaning, automation, or a small API) and describe what it did.",
  sql: "Show SQL in action: mention a query-based analysis or database project and the question it answered.",
  git: "Link a GitHub repository with a clear commit history, or mention team workflows like branches and pull requests.",
  aws: "Mention any AWS service you've used (S3, EC2, Lambda) and what you built with it.",
  react: "Build or link a React project and note the components or state handling you wrote.",
  typescript: "Convert a small JavaScript project to TypeScript and mention it on your résumé.",
  excel: "Describe a spreadsheet model or analysis, naming features like pivot tables or lookups.",
  "node.js": "Add a Node.js project, such as a REST API, and say what it connects to.",
  java: "Include a Java course project or app, and name the concepts it covered.",
  "c#": "Include a C# project or coursework, such as a console app or a .NET API.",
  tableau: "Publish a Tableau dashboard and describe the insight it showed.",
  "power bi": "Build a Power BI report from a public dataset and list it under projects.",
  docker: "Containerize one of your projects and mention it in the project description.",
};

function buildFeedback(r, companyName) {
  const out = [];
  if (r.matchedRequired.length) {
    out.push(`Strength: you already cover ${r.matchedRequired.join(", ")}, which ${companyName} lists as required. Put these near the top of your résumé.`);
  }
  if (r.missingRequired.length) {
    for (const skill of r.missingRequired) {
      out.push(
        TIPS[normalize(skill)] ||
          `If you've used ${skill}, add a project or experience bullet that shows it. If not, a short course or small project would help.`
      );
    }
  } else if (r.matchedRequired.length) {
    out.push("You cover every required skill listed. Focus on showing results (numbers, outcomes) in your bullets.");
  }
  if (r.missingPreferred.length) {
    out.push(`Nice to have: ${r.missingPreferred.join(", ")}. These are preferred rather than required, so add them after the required skills.`);
  }
  if (r.matchedPreferred.length) {
    out.push(`Bonus: you also match the preferred skills ${r.matchedPreferred.join(", ")}.`);
  }
  return out;
}

// ---- Supabase (server-side only) -------------------------------------------
function supabaseBase() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    const err = new Error("Server is missing SUPABASE_URL or SUPABASE_SERVICE_KEY.");
    err.status = 500;
    throw err;
  }
  // Tolerate a pasted "/rest/v1" or trailing slash on the project URL.
  return { url: base.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, ""), key: key.trim() };
}

async function supabaseGet(path) {
  const { url, key } = supabaseBase();
  const headers = { apikey: key, Accept: "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`; // legacy JWT keys only
  const res = await fetch(`${url}/rest/v1/${path}`, { headers });
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch (_) {}
    console.error(`Supabase ${res.status} for /rest/v1/${path.split("?")[0]}: ${detail.slice(0, 300)}`);
    const err = new Error(
      res.status === 404
        ? "Supabase returned 404 for public.companies. Check that SUPABASE_URL is the project URL (https://xxxx.supabase.co), the table is named companies in the public schema, and it is exposed in the Data API."
        : `Supabase request failed (${res.status}).`
    );
    err.status = 502;
    throw err;
  }
  return res.json();
}

async function listCompanies() {
  return supabaseGet("companies?select=id,name&order=name.asc");
}

async function getCompany(id) {
  const rows = await supabaseGet(`companies?id=eq.${encodeURIComponent(id)}&select=id,name,req,pref&limit=1`);
  return rows[0] || null;
}

module.exports = {
  normalize, toList, match, matchText, buildFeedback, listCompanies, getCompany,
};
