const { parseMessage } = require('./nlp/parser');
const { executeCommand } = require('./commands/registry');
const { errorMessages } = require('./formatter');
const { missingEntityMessage } = require('./commands/helpers');
const logger = require('./logger');

const processIncomingText = async (text, context = {}) => {
  const startedAt = Date.now();
  if (/\b(create|add|update|edit|delete|remove|approve|cancel|close|record|make)\b/i.test(text)) {
    logger.warn('write_command_rejected', {
      from: logger.maskPhone(context.phoneNumber),
      text
    });
    return 'This assistant is read-only. It can retrieve information but cannot create, update, delete, approve, or record transactions.';
  }
  const parsed = parseMessage(text);

  logger.info('message_parsed', {
    from: logger.maskPhone(context.phoneNumber),
    intent: parsed.intent,
    confidence: parsed.confidence,
    entities: parsed.entities,
    missingEntities: parsed.missingEntities || []
  });

  if (parsed.entities.invalidDate) return errorMessages.invalidDate;
  if (!parsed.intent) return errorMessages.unknown;
  if (parsed.missingEntities?.length) {
    return missingEntityMessage(parsed.missingEntities[0]);
  }

  const result = await executeCommand(parsed);
  logger.info('command_executed', {
    from: logger.maskPhone(context.phoneNumber),
    intent: parsed.intent,
    durationMs: Date.now() - startedAt
  });
  return result || errorMessages.unknown;
};

module.exports = { processIncomingText };
