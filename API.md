# Tempik API

Tempik exposes a REST API for session management, inbox operations, and message retrieval. All endpoints live under `/api/`.

**Base URL:** `https://YOUR_DOMAIN/api/`

---

## Authentication

Tempik uses **anonymous session tokens** — no login required.

1. Call `GET /api/session` to obtain a `sessionId`
2. Pass `x-session-id` header on all subsequent requests
3. Inboxes are scoped to the session: Browser A cannot see Browser B's inboxes

---

## Endpoints

### GET `/api/config`

Returns the public app configuration.

**Headers:** none

**Response** `200 OK`

```json
{
  "appName": "Tempik",
  "mailDomain": "example.com",
  "webHost": "tempik.example.com"
}
```

---

### GET `/api/session`

Creates or retrieves an anonymous browser session. If you pass an existing `x-session-id`, it returns the same ID. If you don't, it generates a new one.

**Headers**

| Header | Required | Description |
|---|---|---|
| `x-session-id` | No | Existing session ID (UUID v4). Omit to create a new session. |

**Response** `200 OK`

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Usage**

```bash
# Create a new session
curl -s https://YOUR_DOMAIN/api/session

# Reuse an existing session
curl -s https://YOUR_DOMAIN/api/session \
  -H "x-session-id: 550e8400-e29b-41d4-a716-446655440000"
```

---

### GET `/api/inboxes`

Lists all inboxes linked to your session.

**Headers**

| Header | Required | Description |
|---|---|---|
| `x-session-id` | **Yes** | Session ID from `/api/session` |

**Response** `200 OK`

```json
[
  {
    "address": "kopihujan23@example.com",
    "created_at": "2026-06-26 07:48:19"
  }
]
```

**Errors**

| Status | Message | Meaning |
|---|---|---|
| `400` | `Missing x-session-id` | No session header provided |

**Usage**

```bash
curl -s https://YOUR_DOMAIN/api/inboxes \
  -H "x-session-id: 550e8400-e29b-41d4-a716-446655440000"
```

---

### POST `/api/inboxes`

Creates a new inbox (or claims an existing one) and links it to your session.

**Headers**

| Header | Required | Description |
|---|---|---|
| `x-session-id` | **Yes** | Session ID |
| `Content-Type` | Yes | `application/json` |

**Request Body**

| Field | Required | Description |
|---|---|---|
| `localPart` | No | Custom username (e.g. `"myname"`). Omit for a random address. |
| `domain` | No | Domain override. Defaults to the configured `MAIL_DOMAIN`. |

**Examples**

```json
// Custom address
{ "localPart": "myinbox" }
// → myinbox@example.com

// Random address
{}
// → langitbiru23@example.com

// Custom domain
{ "localPart": "test", "domain": "other.com" }
// → test@other.com
```

**Response** `201 Created`

```json
{
  "address": "langitbiru23@example.com",
  "created_at": "2026-06-26 07:48:19"
}
```

**Errors**

| Status | Message | Meaning |
|---|---|---|
| `400` | `Missing x-session-id` | No session header provided |

**Notes**
- If the address already exists, it simply links the existing inbox to your session
- Random addresses are human-readable Indonesian-style (e.g. `kopihujan42`, `bulanbiru17`)
- The generator ensures uniqueness — it never creates duplicates

**Usage**

```bash
# Create with custom name
curl -s -X POST https://YOUR_DOMAIN/api/inboxes \
  -H "x-session-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{"localPart":"myinbox"}'

# Create random
curl -s -X POST https://YOUR_DOMAIN/api/inboxes \
  -H "x-session-id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### DELETE `/api/inboxes/:address`

Removes an inbox from your session. Does **not** delete the inbox or its messages from the database — it just unlinks it from your session so it no longer appears in your list.

**Headers**

| Header | Required | Description |
|---|---|---|
| `x-session-id` | **Yes** | Session ID |

**Path Parameters**

| Param | Description |
|---|---|
| `address` | Full email address, URI-encoded. Example: `test123%40example.com` |

**Response** `200 OK`

```json
{ "ok": true }
```

**Errors**

| Status | Message | Meaning |
|---|---|---|
| `400` | `Missing x-session-id` | No session header |

**Usage**

```bash
curl -s -X DELETE "https://YOUR_DOMAIN/api/inboxes/test123%40example.com" \
  -H "x-session-id: 550e8400-e29b-41d4-a716-446655440000"
```

---

### GET `/api/inboxes/:address/messages`

Fetches all messages for a given inbox. The inbox must be linked to your session.

**Headers**

| Header | Required | Description |
|---|---|---|
| `x-session-id` | **Yes** | Session ID |

**Path Parameters**

| Param | Description |
|---|---|
| `address` | Full email address, URI-encoded. |

**Response** `200 OK`

```json
[
  {
    "id": "msg_1782461413912_0956a83c",
    "inbox_address": "test123@example.com",
    "from_address": "someone@gmail.com",
    "subject": "Hello",
    "body": "This is the email body",
    "received_at": "2026-06-26 08:10:14"
  }
]
```

**Errors**

| Status | Message | Meaning |
|---|---|---|
| `400` | `Missing x-session-id` | No session header |
| `403` | `Inbox not in this session` | The inbox exists but is not linked to your session. Use `POST /api/inboxes` with the matching `localPart` to claim it first. |

**Usage**

```bash
curl -s "https://YOUR_DOMAIN/api/inboxes/test123%40example.com/messages" \
  -H "x-session-id: 550e8400-e29b-41d4-a716-446655440000"
```

---

## Full flow example

```bash
DOMAIN="tempik.YOURDOMAIN.com"

# 1. Get session
SESSION=$(curl -s https://$DOMAIN/api/session | jq -r '.sessionId')

# 2. Create an inbox
INBOX=$(curl -s -X POST https://$DOMAIN/api/inboxes \
  -H "x-session-id: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.address')
echo "Created: $INBOX"

# 3. ...wait for an email to arrive...

# 4. List inboxes
curl -s https://$DOMAIN/api/inboxes -H "x-session-id: $SESSION" | jq '.'

# 5. Read messages
ENCODED=$(echo -n "$INBOX" | jq -sRr '@uri')
curl -s "https://$DOMAIN/api/inboxes/$ENCODED/messages" \
  -H "x-session-id: $SESSION" | jq '.'

# 6. Delete inbox from session
curl -s -X DELETE "https://$DOMAIN/api/inboxes/$ENCODED" \
  -H "x-session-id: $SESSION"
```

---

## Errors

All error responses follow this format:

```json
{
  "error": "Human-readable error message"
}
```

| Status | When |
|---|---|
| `400` | Missing `x-session-id` header |
| `403` | Unauthorized — inbox not linked to your session |
| `404` | Route not found |

---

## Session isolation

Tempik uses per-browser anonymous sessions:

| Scenario | Behavior |
|---|---|
| New browser | Empty inbox list |
| After creating inbox A | Only inbox A appears in that browser |
| Open in incognito | Empty — different session |
| Refresh same browser | Inboxes persist (via `localStorage`) |
| Send email to inbox A | Inbox A gets it instantly (email handler auto-creates inbox record) |
