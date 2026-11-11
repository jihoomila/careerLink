// api/analyze-resume.js  (Vercel serverless function, CommonJS)
//
// GET  /api/analyze-resume  -> [{ id, name }]  (company list for the dropdown)
// POST /api/analyze-resume  -> { companyId, skills: "Python, SQL, Git" | ["Python", ...] }
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY (server-side only)
// Scoring and feedback live in ../lib/analysis.js so upload-resume.js can reuse them.

const { match, toList, buildFeedback, listCompanies, getCompany } = require("../lib/analysis");

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      return res.status(200).json(await listCompanies());
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed." });
    }

    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
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
    if (!company) return res.status(404).json({ error: "Company not found." });

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
