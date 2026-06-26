import type { D1Database } from '@cloudflare/workers-types';

export interface Inbox {
  address: string;
  created_at: string;
}

export interface Message {
  id: string;
  inbox_address: string;
  from_address: string;
  subject: string;
  body: string;
  received_at: string;
}

export interface Session {
  id: string;
  created_at: string;
}

// ---- Inboxes ----

export async function getInbox(db: D1Database, address: string): Promise<Inbox | null> {
  return db.prepare('SELECT * FROM inboxes WHERE address = ?').bind(address).first<Inbox>();
}

export async function createInbox(db: D1Database, address: string): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO inboxes (address) VALUES (?)').bind(address).run();
}

export async function inboxExists(db: D1Database, address: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM inboxes WHERE address = ? LIMIT 1').bind(address).first();
  return !!row;
}

export async function getSessionInboxes(db: D1Database, sessionId: string): Promise<Inbox[]> {
  return db
    .prepare(
      `SELECT i.* FROM inboxes i
       INNER JOIN session_inboxes si ON si.inbox_address = i.address
       WHERE si.session_id = ?
       ORDER BY i.created_at DESC`
    )
    .bind(sessionId)
    .all<Inbox>()
    .then((r) => r.results);
}

// ---- Messages ----

export async function getMessages(db: D1Database, inboxAddress: string): Promise<Message[]> {
  return db
    .prepare(
      'SELECT * FROM messages WHERE inbox_address = ? ORDER BY received_at DESC'
    )
    .bind(inboxAddress)
    .all<Message>()
    .then((r) => r.results);
}

export async function insertMessage(
  db: D1Database,
  msg: Omit<Message, 'received_at'>
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO messages (id, inbox_address, from_address, subject, body)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(msg.id, msg.inbox_address, msg.from_address, msg.subject, msg.body)
    .run();
}

// ---- Sessions ----

export async function ensureSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO sessions (id) VALUES (?)').bind(sessionId).run();
}

export async function sessionExists(db: D1Database, sessionId: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM sessions WHERE id = ? LIMIT 1').bind(sessionId).first();
  return !!row;
}

// ---- Session-Inbox links ----

export async function linkInboxToSession(
  db: D1Database,
  sessionId: string,
  address: string
): Promise<void> {
  await db
    .prepare(
      'INSERT OR IGNORE INTO session_inboxes (session_id, inbox_address) VALUES (?, ?)'
    )
    .bind(sessionId, address)
    .run();
}

export async function unlinkInboxFromSession(
  db: D1Database,
  sessionId: string,
  address: string
): Promise<void> {
  await db
    .prepare('DELETE FROM session_inboxes WHERE session_id = ? AND inbox_address = ?')
    .bind(sessionId, address)
    .run();
}

export async function isInboxInSession(
  db: D1Database,
  sessionId: string,
  address: string
): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM session_inboxes WHERE session_id = ? AND inbox_address = ? LIMIT 1')
    .bind(sessionId, address)
    .first();
  return !!row;
}
