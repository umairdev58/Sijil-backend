# Sijil Record WhatsApp Assistant

The WhatsApp assistant is deterministic and read-only. It does not use an LLM,
machine learning, embeddings, a vector database, or an external NLP service.

## Meta test environment setup

1. Create or open a Meta developer app and add the WhatsApp product.
2. Use the test phone number supplied by Meta.
3. Configure these backend environment variables:

   ```env
   WHATSAPP_VERIFY_TOKEN=choose-a-long-random-verification-token
   WHATSAPP_ACCESS_TOKEN=meta-test-access-token
   WHATSAPP_PHONE_NUMBER_ID=meta-test-phone-number-id
   WHATSAPP_API_VERSION=v21.0
   WHATSAPP_APP_SECRET=meta-app-secret
   ```

   `WHATSAPP_APP_SECRET` enables `X-Hub-Signature-256` validation. It is
   optional in the test environment but recommended. Never commit these values.

4. Set the Meta callback URL to:

   ```text
   https://YOUR_BACKEND_HOST/api/whatsapp/webhook
   ```

5. Enter the same `WHATSAPP_VERIFY_TOKEN` in Meta and subscribe the webhook to
   the `messages` field.
6. Restart the backend after changing environment variables.
7. Sign in to Sijil Record as an admin, open **Settings → WhatsApp Assistant**,
   and add each allowed number with its full international country code.

Phone numbers are normalized to digits before storage and comparison. A sender
must have an active allowlist record before parsing or business queries run.

## Supported behavior

- Receives text messages and replies through the Meta Cloud API.
- Logs incoming messages, parsed intents, extracted entities, execution time,
  outbound message IDs, delivery/read/failure status callbacks, and errors.
- Rejects unauthorized senders before command processing.
- Rejects create, update, delete, approve, close, and transaction-recording
  language. Command handlers are registered with `mode: 'read'`.
- Returns human-readable WhatsApp text, never raw JSON.
- Does not send PDFs or media in the initial version.

Type `help` in WhatsApp for the user-facing command menu.
See `COMMAND_CATALOG.md` for the complete implemented command catalog.

## How parsing works

The flow is:

1. `nlp/entities.js` extracts dates, statuses, invoice numbers, container
   numbers, names, agents, categories, and list limits.
2. `nlp/parser.js` scores declarative intent definitions using exact keywords,
   synonyms, regular expressions, and light Levenshtein fuzzy matching.
3. `commands/registry.js` enforces read-only mode and dispatches the selected
   intent.
4. A command module performs Mongoose read queries and returns formatted text.

Invalid dates, unknown commands, missing entities, multiple directory matches,
authorization failures, and internal errors have user-friendly replies.

## Adding a read-only command

### 1. Define the intent

Add an entry to `utils/whatsapp/nlp/intents.js`:

```js
intent('sales.example', 'sales', 'example', ['sales', 'example'], {
  synonyms: ['example sales phrase'],
  patterns: [/\bexample\s+sales\b/i],
  requiredEntities: ['dateRange'],
  priority: 2,
  examples: ['example sales this month']
})
```

Keep `mode: 'read'`; the intent helper applies it automatically. Use
`requiredAny` when a domain has several aliases but an action word must also be
present.

### 2. Reuse or add entity extraction

Use existing entities where possible. If a new entity is needed, add its
deterministic regex extraction to `nlp/entities.js`. Add a corresponding prompt
to `commands/helpers.js` so missing values produce a clear reply.

### 3. Implement the handler

Add a handler to the appropriate file under `utils/whatsapp/commands/`.
Handlers receive:

```js
{
  intent,
  entities,
  confidence,
  normalizedText
}
```

Only use Mongoose read operations such as `find`, `findOne`, `countDocuments`,
and read-only `aggregate` pipelines. Do not call `save`, `create`, update,
delete, payment, approval, or workflow methods.

Return a string using helpers from `formatter.js`:

```js
const { heading, money, limitedList } = require('../formatter');
```

Limit list responses (normally 10, never more than 20) to stay within
WhatsApp's text-message limit.

### 4. Register the handler

Add the intent ID and handler to `commands/registry.js`. The registry rejects
non-read command modes.

### 5. Add tests

Add representative phrases to `tests/whatsappParser.js`, then run:

```bash
npm test
```

Also verify that every intent has a handler:

```bash
node -e "const i=require('./utils/whatsapp/nlp/intents'); const r=require('./utils/whatsapp/commands/registry').handlers; console.log(i.filter(x=>!r[x.id]).map(x=>x.id))"
```

The output should be an empty array.

## Main files

- `routes/whatsapp.js` — webhook and admin allowlist routes
- `controllers/whatsappController.js` — verification, signature checking,
  inbound/status processing, authorization-first flow
- `models/WhatsAppAuthorizedNumber.js` — persisted allowlist
- `utils/whatsapp/metaClient.js` — Meta text-send client
- `utils/whatsapp/assistant.js` — parse/execute orchestration
- `utils/whatsapp/nlp/intents.js` — command catalog
- `utils/whatsapp/commands/registry.js` — read-only dispatch
- `utils/whatsapp/formatter.js` — WhatsApp response formatting

## Production expansion boundary

This integration targets only the Meta test environment. Before production,
review token lifecycle, persistent webhook idempotency, retry/queue handling,
rate limiting, operational monitoring, data-retention policy, and WhatsApp
template requirements. Do not add write commands without a separate,
explicitly reviewed authorization and confirmation design.
