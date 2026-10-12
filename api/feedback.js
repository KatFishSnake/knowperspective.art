// "Suggest an edit" endpoint. Forwards one feedback item to the Convex
// ingest.batch mutation that am-i-industry-ready.art uses, so suggestions land
// in the same admin feedback list. `path` is prefixed with this site's host so
// the two sites stay distinguishable there.
//
// Env (Vercel project settings): CONVEX_URL, CONVEX_SERVER_KEY, and optionally
// IP_HASH_SALT. Without the first two the endpoint answers 503 and the form
// shows its error state instead of pretending the suggestion was received.

const { createHash, randomUUID } = require('node:crypto');

const SITE = 'knowperspective.art';
const MAX_BYTES = 16 * 1024;
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

function decode(v) {
  if (!v) return undefined;
  try { return decodeURIComponent(v); } catch { return v; }
}

function deviceType(ua) {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) return 'mobile';
  return 'desktop';
}

function hashIp(xff) {
  const ip = xff ? String(xff).split(',')[0].trim() : '';
  const salt = process.env.IP_HASH_SALT;
  if (!ip || !salt) return undefined;
  return createHash('sha256').update(ip + ':' + salt).digest('hex');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  if (Number(req.headers['content-length'] || 0) > MAX_BYTES) return res.status(413).json({ ok: false });

  const url = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
  const serverKey = process.env.CONVEX_SERVER_KEY;
  if (!url || !serverKey) return res.status(503).json({ ok: false });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ ok: false });

  const text = str(body.text, 5000);
  if (!text) return res.status(400).json({ ok: false });
  const where = str(body.where, 200);
  const page = typeof body.path === 'string' && body.path.startsWith('/') ? body.path.slice(0, 200) : '/';
  const visitorId = ID_RE.test(body.visitorId || '') ? body.visitorId : randomUUID();
  const sessionId = ID_RE.test(body.sessionId || '') ? body.sessionId : randomUUID();

  const h = req.headers;
  const ua = h['user-agent'] || '';
  const now = Date.now();
  const args = {
    serverKey,
    batch: {
      v: 1,
      visitorId,
      sessionId,
      sentAt: now,
      items: [{
        kind: 'feedback',
        at: now,
        text: where ? '[' + where + '] ' + text : text,
        contact: str(body.contact, 300),
        path: SITE + page,
      }],
    },
    server: {
      geo: {
        country: h['x-vercel-ip-country'] || undefined,
        region: h['x-vercel-ip-country-region'] || undefined,
        city: decode(h['x-vercel-ip-city']),
        timezone: h['x-vercel-ip-timezone'] || undefined,
      },
      ipHash: hashIp(h['x-forwarded-for']),
      userAgent: ua || undefined,
      deviceType: ua ? deviceType(ua) : undefined,
      isBot: ua ? /bot|crawl|spider|headless|lighthouse/i.test(ua) : undefined,
      receivedAt: now,
    },
  };

  try {
    const r = await fetch(url.replace(/\/$/, '') + '/api/mutation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'ingest:batch', args, format: 'json' }),
    });
    const out = await r.json().catch(() => null);
    if (!r.ok || !out || out.status !== 'success') return res.status(502).json({ ok: false });
  } catch {
    return res.status(502).json({ ok: false });
  }
  return res.status(200).json({ ok: true });
};
