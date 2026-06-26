import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import {
  getInbox,
  createInbox,
  inboxExists,
  getSessionInboxes,
  getMessages,
  ensureSession,
  linkInboxToSession,
  unlinkInboxFromSession,
  isInboxInSession,
} from '../db/queries';
import { generateUniqueAddress } from '../utils/random-address';

export interface ApiEnv {
  DB: D1Database;
  APP_NAME: string;
  MAIL_DOMAIN: string;
  WEB_HOST: string;
}

function sessionId(c: any): string | null {
  return (c.req.header('x-session-id') || '').trim() || null;
}

function requireSession(c: any): string {
  const sid = sessionId(c);
  if (!sid) {
    c.status(400);
    return '';
  }
  return sid;
}

const api = new Hono<{ Bindings: ApiEnv }>();

// ---- GET /api/config ----
api.get('/config', (c) => {
  return c.json({
    appName: c.env.APP_NAME || 'Tempik',
    mailDomain: c.env.MAIL_DOMAIN || 'example.com',
    webHost: c.env.WEB_HOST || 'tempik.example.com',
  });
});

// ---- GET /api/session ----
api.get('/session', async (c) => {
  let sid = sessionId(c);
  if (!sid) {
    sid = crypto.randomUUID();
  }
  await ensureSession(c.env.DB, sid);
  return c.json({ sessionId: sid });
});

// ---- GET /api/inboxes ----
api.get('/inboxes', async (c) => {
  const sid = requireSession(c);
  if (!sid) return c.json({ error: 'Missing x-session-id' }, 400);

  const inboxes = await getSessionInboxes(c.env.DB, sid);
  return c.json(inboxes);
});

// ---- POST /api/inboxes ----
api.post('/inboxes', async (c) => {
  const sid = requireSession(c);
  if (!sid) return c.json({ error: 'Missing x-session-id' }, 400);

  const body = await c.req.json().catch(() => ({}));
  const domain = body.domain || c.env.MAIL_DOMAIN || 'example.com';
  const requested: string = (body.localPart || '').trim().toLowerCase();

  let address: string;
  if (requested) {
    address = `${requested}@${domain}`;
  } else {
    const dataInboxes = new Set(
      (await getSessionInboxes(c.env.DB, sid)).map((i) => i.address)
    );
    address = generateUniqueAddress(
      (addr) => dataInboxes.has(addr),
      domain
    );
  }

  // Ensure inbox record exists
  await createInbox(c.env.DB, address);

  // Link to session
  await linkInboxToSession(c.env.DB, sid, address);

  const inbox = await getInbox(c.env.DB, address);
  return c.json(inbox!, 201);
});

// ---- DELETE /api/inboxes/:address ----
api.delete('/inboxes/:address', async (c) => {
  const sid = requireSession(c);
  if (!sid) return c.json({ error: 'Missing x-session-id' }, 400);

  const address = decodeURIComponent(c.req.param('address'));
  await unlinkInboxFromSession(c.env.DB, sid, address);
  return c.json({ ok: true });
});

// ---- GET /api/inboxes/:address/messages ----
api.get('/inboxes/:address/messages', async (c) => {
  const sid = requireSession(c);
  if (!sid) return c.json({ error: 'Missing x-session-id' }, 400);

  const address = decodeURIComponent(c.req.param('address'));

  // Must have inbox in session to read messages
  if (!(await isInboxInSession(c.env.DB, sid, address))) {
    return c.json({ error: 'Inbox not in this session' }, 403);
  }

  const messages = await getMessages(c.env.DB, address);
  return c.json(messages);
});

export default api;
