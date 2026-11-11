const crypto = require('crypto');
const { COMPANIES } = require('./_companies');
const { sb } = require('./_supabase');

// RECRUITER_CODES = {"robo":"<code>","soft":"<code>"}  (Vercel env var, server-side only)
function companyForCode(code) {
  if (typeof code !== 'string' || !code) return null;
  let codes;
  try { codes = JSON.parse(process.env.RECRUITER_CODES || '{}'); } catch { return null; }
  const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
  const given = hash(code);
  for (const [id, secret] of Object.entries(codes)) {
    if (COMPANIES[id] && secret && crypto.timingSafeEqual(given, hash(secret))) return id;
  }
  return null;
}

async function sendEmail(row, co) {
  if (!row.email) throw new Error('No email on file');
  const text = `It's your turn at ${co.name}. Please head to ${co.booth}. Your ticket is #${row.ticket}.`;
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'CareerLink', email: process.env.EMAIL_FROM },
      to: [{ email: row.email }],
      subject: `It's your turn at ${co.name} (ticket #${row.ticket})`,
      textContent: text,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Email provider returned ${r.status}`);
}

// Sends exactly once per claim. Never retries automatically.
async function deliver(row, co) {
  let status = 'sent', error = null;
  try { await sendEmail(row, co); } catch (e) { status = 'failed'; error = String(e.message).slice(0, 300); console.error('email failed:', error); }
  try { await sb(`/entries?id=eq.${row.id}`, { method: 'PATCH', body: { email_status: status, email_error: error } }); }
  catch (e) { console.error('status update failed:', e.message); }
  return status;
}

async function getLast(companyId) {
  const rows = await sb(`/entries?company_id=eq.${companyId}&status=eq.called&order=called_at.desc&limit=1&select=id,ticket,email,email_status`);
  return rows[0] || null;
}

// Recruiter-safe view: never includes student email or name.
const view = (co, last, extra = {}) => ({
  company: co.name,
  booth: co.booth,
  last: last ? { ticket: last.ticket, emailStatus: last.email_status } : null,
  ...extra,
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { code, action } = req.body || {};
  const companyId = companyForCode(code);
  if (!companyId) return res.status(401).json({ error: 'Invalid access code' });
  const co = COMPANIES[companyId];

  try {
    if (action === 'status') {
      return res.json(view(co, await getLast(companyId)));
    }

    if (action === 'call') {
      const rows = await sb('/rpc/call_next', { method: 'POST', body: { p_company_id: companyId } });
      if (!rows.length) return res.json(view(co, await getLast(companyId), { empty: true }));
      const emailStatus = await deliver(rows[0], co);
      return res.json(view(co, { ticket: rows[0].ticket, email_status: emailStatus }, { called: rows[0].ticket }));
    }

    if (action === 'resend') {
      const last = await getLast(companyId);
      if (!last || last.email_status !== 'failed') return res.status(409).json({ error: 'Nothing to resend' });
      // Atomic claim: only one request can move failed -> sending.
      const claimed = await sb(`/entries?id=eq.${last.id}&email_status=eq.failed`, {
        method: 'PATCH', body: { email_status: 'sending' }, prefer: 'return=representation',
      });
      if (!claimed.length) return res.status(409).json({ error: 'Already being resent' });
      const emailStatus = await deliver(claimed[0], co);
      return res.json(view(co, { ticket: last.ticket, email_status: emailStatus }));
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('call-next failed:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
};
