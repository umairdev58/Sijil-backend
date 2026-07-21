const crypto = require('crypto');
const { authorizePhoneNumber } = require('../utils/whatsapp/authorize');
const { sendTextMessage } = require('../utils/whatsapp/metaClient');
const { processIncomingText } = require('../utils/whatsapp/assistant');
const logger = require('../utils/whatsapp/logger');

const processedMessageIds = new Set();

const isValidSignature = (req) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return true;

  const signature = req.get('x-hub-signature-256');
  if (!signature || !req.rawBody) return false;

  const expected = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest('hex')}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const configuredToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (configuredToken && mode === 'subscribe' && token === configuredToken) {
    logger.info('webhook_verified');
    return res.status(200).send(challenge);
  }

  logger.warn('webhook_verification_failed');
  return res.sendStatus(403);
};

const rememberMessage = (messageId) => {
  if (!messageId) return true;
  if (processedMessageIds.has(messageId)) return false;
  processedMessageIds.add(messageId);
  if (processedMessageIds.size > 1000) {
    processedMessageIds.delete(processedMessageIds.values().next().value);
  }
  return true;
};

const processStatusUpdates = (statuses = []) => {
  statuses.forEach((status) => {
    logger.info('message_status', {
      messageId: status.id,
      recipient: logger.maskPhone(status.recipient_id),
      status: status.status,
      error: status.errors?.[0]?.title || status.errors?.[0]?.message
    });
  });
};

const processMessage = async (message, contact) => {
  const startedAt = Date.now();
  const from = message.from;

  logger.info('incoming_message', {
    from: logger.maskPhone(from),
    messageId: message.id,
    type: message.type,
    text: message.type === 'text' ? message.text?.body : undefined,
    contactName: contact?.profile?.name
  });

  try {
    const authorization = await authorizePhoneNumber(from);
    if (!authorization.authorized) {
      logger.warn('unauthorized_message', { from: logger.maskPhone(from) });
      await sendTextMessage(from, 'You are not authorized to use this assistant.');
      return;
    }

    if (message.type !== 'text') {
      await sendTextMessage(from, 'Please send a text message. Type *help* to see available commands.');
      return;
    }

    const response = await processIncomingText(message.text?.body || '', {
      phoneNumber: from,
      authorization: authorization.authorization
    });
    await sendTextMessage(from, response);
  } catch (error) {
    logger.error('message_processing_error', {
      from: logger.maskPhone(from),
      messageId: message.id,
      durationMs: Date.now() - startedAt,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    try {
      await sendTextMessage(from, 'Sorry, I could not complete that request. Please try again later.');
    } catch (sendError) {
      logger.error('error_reply_failed', { error: sendError.message });
    }
  }
};

const receiveWebhook = (req, res) => {
  if (!isValidSignature(req)) {
    logger.warn('webhook_signature_invalid');
    return res.sendStatus(403);
  }

  res.sendStatus(200);

  const entries = req.body?.entry || [];
  entries.forEach((entry) => {
    (entry.changes || []).forEach((change) => {
      const value = change.value || {};
      processStatusUpdates(value.statuses);
      (value.messages || []).forEach((message) => {
        if (rememberMessage(message.id)) {
          processMessage(message, value.contacts?.[0]);
        }
      });
    });
  });
};

module.exports = { verifyWebhook, receiveWebhook };
