import PostalMime from 'postal-mime';
import type { D1Database } from '@cloudflare/workers-types';
import { createInbox, inboxExists, insertMessage } from './db/queries';

export interface EmailHandlerEnv {
  DB: D1Database;
  MAIL_DOMAIN: string;
}

/**
 * Handles inbound email via Cloudflare Email Worker.
 * Called for every email received at any @<MAIL_DOMAIN> address.
 */
export async function handleEmail(message: ForwardableEmailMessage, env: EmailHandlerEnv): Promise<void> {
  const to = message.to.toLowerCase();
  const from = message.from.toLowerCase();

  console.log(`[email] Received from=${from} to=${to}`);

  try {
    // Read raw email stream
    const rawStream = message.raw;
    const parser = new PostalMime();
    const parsed = await parser.parse(rawStream);

    const subject = parsed.subject || '(no subject)';
    const body = parsed.text?.trim() || parsed.html || '';

    const db = env.DB;

    // Auto-create inbox if doesn't exist
    if (!(await inboxExists(db, to))) {
      await createInbox(db, to);
      console.log(`[email] Created new inbox: ${to}`);
    }

    // Store the message
    const msgId = `msg_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    await insertMessage(db, {
      id: msgId,
      inbox_address: to,
      from_address: from,
      subject,
      body,
    });

    console.log(`[email] Stored message ${msgId} for ${to}`);
  } catch (err) {
    console.error(`[email] Failed to process email for ${to}:`, err);
    // Don't throw — we don't want to bounce; just log
  }
}
