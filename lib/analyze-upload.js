// lib/analyze-upload.js
// Call this from api/upload-resume.js AFTER the file upload and submission record succeeded.
// It never throws, so a parsing or Supabase problem can't turn a saved upload into a failure.
"use strict";

const { matchText, buildFeedback, getCompany } = require("./analysis");

const MIN_TEXT_CHARS = 30; // fewer than this = probably a scanned/image-only PDF

async function extractPdfText(buffer) {
  // Import the inner file: the package entry point runs a debug routine that breaks on Vercel.
  const pdfParse = require("pdf-parse/lib/pdf-parse.js");
  const data = await pdfParse(buffer);
  return data.text || "";
}

async function analyzeUploadedResume({ buffer: given, fileBase64, companyId }) {
  try {
    const b64 = String(fileBase64 || "").replace(/^data:[^;]*;base64,/, "");
    const buffer = given || Buffer.from(b64, "base64");

    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return {
        status: "unsupported",
        message: "Your file was saved. Skill analysis currently works on PDF résumés only.",
      };
    }

    const text = await extractPdfText(buffer);
    if (text.replace(/\s+/g, "").length < MIN_TEXT_CHARS) {
      return {
        status: "no_text",
        message: "Your file was saved, but we couldn't extract text from this PDF. It may be a scan or an image. Try uploading a PDF exported from Word or Google Docs.",
      };
    }

    const company = await getCompany(String(companyId));
    if (!company) {
      return { status: "error", message: "Your file was saved, but we couldn't find this company's skill list." };
    }

    const result = matchText(company.req, company.pref, text);
    return {
      status: "ok",
      company: { id: company.id, name: company.name },
      ...result,
      feedback: buildFeedback(result, company.name),
    };
  } catch (err) {
    console.error("Résumé analysis failed:", err);
    return { status: "error", message: "Your file was saved, but the skill analysis failed. Please try again later." };
  }
}

module.exports = { analyzeUploadedResume, extractPdfText };
