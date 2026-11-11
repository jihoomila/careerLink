// Vercel serverless function: POST /api/upload-resume
// Needs two Environment Variables in Vercel (never put them in browser code):
//   SUPABASE_URL          e.g. https://nqvcesxuydrapctckhca.supabase.co
//   SUPABASE_SERVICE_KEY  your Supabase SECRET key (sb_secret_...)
const { randomUUID } = require("crypto");

const COMPANIES = ["robo", "soft"];
const MAX_BYTES = 3 * 1024 * 1024; // Vercel functions accept ~4.5 MB bodies; base64 adds ~33%
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!URL || !KEY) return res.status(500).json({ error: "Server is not configured" });

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};

  // ---- validate ----
  const company = String(b.company || "");
  const name = String(b.name || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  if (!COMPANIES.includes(company)) return res.status(400).json({ error: "Choose a valid company" });
  if (name.length < 2 || name.length > 100) return res.status(400).json({ error: "Enter your full name" });
  if (email.length > 254 || !EMAIL.test(email)) return res.status(400).json({ error: "Enter a valid email" });
  if (typeof b.fileBase64 !== "string" || !b.fileBase64) return res.status(400).json({ error: "Choose a PDF" });

  const buf = Buffer.from(b.fileBase64, "base64");
  if (!buf.length) return res.status(400).json({ error: "The file is empty" });
  if (buf.length > MAX_BYTES) return res.status(400).json({ error: "PDF must be 3 MB or smaller" });
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return res.status(400).json({ error: "That file is not a PDF" });

  const original = String(b.filename || "resume.pdf").replace(/[^\w.\- ]/g, "_").slice(0, 120);
  const id = randomUUID();
  const path = `${company}/${id}.pdf`; // inside the private "resumes" bucket
  const auth = { apikey: KEY, ...(KEY.startsWith("eyJ") ? { Authorization: `Bearer ${KEY}` } : {}) };

  try {
    // ---- 1. store the file ----
    const up = await fetch(`${URL}/storage/v1/object/resumes/${path}`, {
      method: "POST", headers: { ...auth, "Content-Type": "application/pdf" }, body: buf,
    });
    if (!up.ok) {
      console.error("storage error", up.status, await up.text());
      return res.status(502).json({ error: "Could not store the file" });
    }

    // ---- 2. record who submitted to which company ----
    const row = await fetch(`${URL}/rest/v1/resume_submissions`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ id, company_id: company, name, email, file_path: path, original_filename: original, size_bytes: buf.length }),
    });
    if (!row.ok) {
      console.error("db error", row.status, await row.text());
      await fetch(`${URL}/storage/v1/object/resumes/${path}`, { method: "DELETE", headers: auth }); // no orphan files
      return res.status(502).json({ error: "Could not save the submission" });
    }
    return res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Unexpected server error" });
  }
};
