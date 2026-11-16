// GET /api/device-queue  (read-only, for the StickS3)
// Header:  Authorization: Bearer <DEVICE_TOKEN>
// Vercel env vars (server-side only):
//   DEVICE_TOKEN     long random secret the StickS3 sends
//   DEVICE_ENTRY_ID  the entries.id (uuid) of the one student this device follows
// Also uses the SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY your other api files already use.
const crypto = require('crypto');
const { COMPANIES } = require('./_companies');
const { sb } = require('./_supabase');

const MINUTES_PER_PERSON = 2;
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.DEVICE_TOKEN;
  const entryId = process.env.DEVICE_ENTRY_ID;
  if (!token || !entryId || !UUID.test(entryId)) return res.status(503).json({ error: 'Device is not configured' });

  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m || !crypto.timingSafeEqual(hash(m[1]), hash(token))) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const rows = await sb(`/entries?id=eq.${entryId}&select=id,ticket,company_id,status,called_at&limit=1`);
    const e = rows && rows[0];
    const co = e && COMPANIES[e.company_id];
    if (!e || !co) return res.status(404).json({ error: 'Assigned queue entry not found' });

    let peopleAhead = 0, callId = null;
    if (e.status === 'waiting') {
      const ahead = await sb(`/entries?company_id=eq.${e.company_id}&status=eq.waiting&ticket=lt.${e.ticket}&select=id`);
      peopleAhead = ahead.length;
    } else if (e.status === 'called' && e.called_at) {
      // one call per entry (call_next flips waiting -> called once), so id + called_at is unique and stable
      callId = crypto.createHash('sha256').update(`${e.id}|${e.called_at}`).digest('hex').slice(0, 16);
    }

    return res.json({
      companyName: co.name,
      booth: co.booth,
      peopleAhead,
      estimatedWaitMinutes: peopleAhead * MINUTES_PER_PERSON,
      status: e.status,
      callId,
    });
  } catch (err) {
    console.error('device-queue failed:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
};
