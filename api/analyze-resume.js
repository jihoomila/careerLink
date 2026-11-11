// api/analyze-resume.js  (Vercel serverless function, CommonJS)
//
// GET  /api/analyze-resume            -> [{ id, name }]  (company list for the dropdown)
// POST /api/analyze-resume            -> { companyId, skills: "Python, SQL, Git" | ["Python", ...] }
//
// Required environment variables (Vercel > Project Settings > Environment Variables):
//   SUPABASE_URL                 e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    server-side only. Never put this in browser code.
//
// Assumed table:  companies ( id, name, req, pref )
//   req / pref may be a text[] / jsonb array, or a comma-separated string.

const REQ_WEIGHT = 0.75;
const PREF_WEIGHT = 0.25;

// Common spellings that should count as the same skill.
const ALIASES = {
  js: "javascript",
  "java script": "javascript",
  ecmascript: "javascript",
  ts: "typescript",
  node: "node.js",
  nodejs: "node.js",
  "node js": "node.js",
  reactjs: "react",
  "react.js": "react",
  postgres: "postgresql",
  psql: "postgresql",
  golang: "go",
  "c sharp": "c#",
  py: "python",
  "amazon web services": "aws",
  "ms excel": "excel",
  "microsoft excel": "excel",
  "machine learning": "ml",
  "structured query language": "sql",
  github: "git",
};

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
      try {
        arr = JSON.parse(t);
      } catch (_) {
        arr = t.split(/[,;\n]/);
      }
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
    if (label && !seen.has(key)) {
      seen.add(key);
      out.push(label);
    }
  }
  return out;
}

/**
 * match(req, pref, skills)  Required 75% + Preferred 25%.
 * Exported (handler.match) so the uid / device_key flow can reuse the same calculation.
 */
function match(req, pref, skills) {
  const reqList = toList(req);
  const prefList = toList(pref);
  const have = new Set(toList(skills).map(normalize));

  const matchedRequired = reqList.filter((s) => have.has(normalize(s)));
  const missingRequired = reqList.filter((s) => !have.has(normalize(s)));
  const matchedPreferred = prefList.filter((s) => have.has(normalize(s)));
  const missingPreferred = prefList.filter((s) => !have.has(normalize(s)));

  // Same formula as the team's Supabase Edge Function / js/match.js:
  // an empty list counts as full coverage (ratio 1).
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
    missingRequired,
    matchedPreferred,
    missingPreferred,
  };
}

// Skill-specific advice; anything not listed here gets the generic project suggestion.
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

function buildFeedback({ matchedRequired, missingRequired, matchedPreferred, missingPreferred }, companyName) {
  const feedback = [];

  if (matchedRequired.length) {
    feedback.push(
      `Strength: you already cover ${matchedRequired.join(", ")}, which ${companyName} lists as required. Put these near the top of your résumé.`
    );
  }

  if (missingRequired.length) {
    for (const skill of missingRequired) {
      feedback.push(
        TIPS[normalize(skill)] ||
          `If you've used ${skill}, add a project or experience bullet that shows it. If not, a short course or small project would help.`
      );
    }
  } else if (matchedRequired.length) {
    feedback.push("You cover every required skill listed. Focus on showing results (numbers, outcomes) in your bullets.");
  }

  if (missingPreferred.length) {
    feedback.push(
      `Nice to have: ${missingPreferred.join(", ")}. These are preferred rather than required, so add them after the required skills.`
    );
  }

  if (matchedPreferred.length) {
    feedback.push(`Bonus: you also match the preferred skills ${matchedPreferred.join(", ")}.`);
  }

  return feedback;
}

async function supabaseGet(path) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    const err = new Error("Server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    err.status = 500;
    throw err;
  }
  const res = await fetch(`${base.replace(/\/$/, "")}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const err = new Error(`Supabase request failed (${res.status}).`);
    err.status = 502;
    throw err;
  }
  return res.json();
}

async function getCompany(id) {
  const rows = await supabaseGet(
    `companies?id=eq.${encodeURIComponent(id)}&select=id,name,req,pref&limit=1`
  );
  return rows[0] || null;
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const rows = await supabaseGet("companies?select=id,name&order=name.asc");
      return res.status(200).json(rows);
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed." });
    }

    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (_) {
        body = {};
      }
    }
    body = body || {};

    const companyId = body.companyId;
    const skills = toList(body.skills).slice(0, 50);

    if (companyId === undefined || companyId === null || String(companyId).trim() === "") {
      return res.status(400).json({ error: "Select a company." });
    }
    if (!skills.length) {
      return res.status(400).json({ error: "Enter at least one skill." });
    }

    const company = await getCompany(String(companyId));
    if (!company) {
      return res.status(404).json({ error: "Company not found." });
    }

    const result = match(company.req, company.pref, skills);
    return res.status(200).json({
      company: { id: company.id, name: company.name },
      enteredSkills: skills,
      ...result,
      feedback: buildFeedback(result, company.name),
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ error: err.status ? err.message : "Something went wrong." });
  }
}

module.exports = handler;
module.exports.match = match;
module.exports.toList = toList;
