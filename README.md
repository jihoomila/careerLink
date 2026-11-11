# CareerLink — all three features (local prototype)

This is the existing four-page CareerLink frontend, with all three features implemented as a **local browser demo**. It does **not** connect to Supabase, send recruiter messages, or perform AI/PDF parsing. No credentials are needed.

## Pages
- `index.html`: existing home
- `queue.html`: **Join Queue** generates sequential per-company queue numbers and estimated waits (3 min per person), saved to **localStorage** in this browser. It does not synchronize across devices or manage actual serving/completion.
- `upload.html`: **Upload Résumé** validates a PDF/DOCX up to 10 MB and stores the **actual file bytes** plus name/email/company in browser **IndexedDB**. It does not upload to a server, deliver to a recruiter, or provide a company dashboard. Browser site data clearing deletes saved files.
- `analyze.html`: **Analyze Résumé** compares manually entered skill keywords with illustrative role requirements, shows 75% required + 25% preferred match, missing skills, and template-based feedback. No AI or PDF extraction.

## Test
1. Open `index.html` in a browser. Prefer a local static server (`python -m http.server 8000`) for consistent IndexedDB behavior, then open `http://localhost:8000`.
2. Join Queue: choose Microsoft, enter name/email, click Get Queue Number. Repeat to see #02 and a ~3 min estimate. Refresh and confirm the counter remains.
3. Upload Résumé: choose company, enter name/email, select a test PDF or DOCX <=10 MB, click Save Demo Submission. Confirmation states local storage only.
4. Analyze: Software Engineering Intern, `Python, SQL, AWS` gives 50%, with matched and missing skills.

## GitHub and Vercel
Upload **contents** of this folder to the frontend repository root (or set Vercel Root Directory accordingly). Vercel can deploy as a static site; no build step required. Note that localStorage/IndexedDB are origin-specific: files saved at localhost do not appear on Vercel, and one student's browser cannot see another student's data.

## To make it a real multi-user career fair station
- Queue: add a secured Supabase Edge Function to atomically issue company-scoped queue numbers, track status, and return estimated waits; connect `queue.html` to it.
- Resume: create a **private** Supabase Storage bucket and authenticated upload endpoint, validate file type/size server-side, store submission metadata and company ID, and provide a recruiter-only view. Never put service-role keys in browser JavaScript.
- Match: optionally read actual company req/pref from a secured endpoint; the current Supabase match Edge Function expects `uid` and `device_key`, so it cannot be called directly from this keyword-entry page without an API redesign. Do not embed `device_key` in a public page.
- Add rate limits, access controls, retention/deletion policy and consent before collecting real student information.

This is a **working local demo**, not a live backend integration.
