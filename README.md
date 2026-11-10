# CareerLink frontend

Four English pages built with plain HTML, CSS and JavaScript. No installation, framework or build step is required.

## Open

Extract the ZIP and open `index.html` in a browser. For development, VS Code Live Server also works. Keep the folders together so relative links load correctly.

## Files

- `index.html` — home with three service cards
- `queue.html` — company selection, name/email form and sample queue confirmation
- `upload.html` — company selection, file picker/drop area and local submission preview
- `analyze.html` — company/role selection, file picker and sample match report
- `css/styles.css` — shared responsive styles
- `js/app.js` — shared validation, drag/drop and sample interactions

## Implemented

Real page links, responsive layouts, required-field/email validation, PDF/DOCX filename and size checks (non-empty, up to 10 MB), drag/drop, safe display of file names, keyboard focus and accessible result announcements. Invalid file selection clears the previous selection. Files must be selected again after navigating or refreshing; no file is persisted.

## Backend integration

This is frontend-only. Company choices, queue counts, queue number, waiting time and the 78% report are examples. No data is saved, no file is uploaded, no email/SMS is sent, and no AI service is called.

Replace the three submit branches in `js/app.js` with calls to your backend when ready:

1. Queue: send the selected company and visitor details; display the queue ticket and estimate returned by the server.
2. Upload: send `selectedFile` and company using FormData to your upload endpoint.
3. Analyze: send the résumé and target role to a backend endpoint; render its actual analysis response.

API endpoints and response formats have not been supplied, so none are invented here. Keep AI keys and Supabase service-role keys on the server. The backend must validate files and enforce access rules; browser checks alone are insufficient.

Fonts use Google Fonts with local system-font fallbacks. All page interactions work without that font request.
