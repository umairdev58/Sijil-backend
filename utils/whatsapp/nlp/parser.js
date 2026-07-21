const intents = require('./intents');
const { extractEntities } = require('./entities');
const { isFuzzyMatch } = require('./fuzzy');

const normalize = (text) => String(text || '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s/_#.+-]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const phraseMatches = (text, phrase) => {
  const normalizedPhrase = normalize(phrase);
  if (text.includes(normalizedPhrase)) return true;
  if (normalizedPhrase.includes(' ')) return false;
  return text.split(' ').some((token) => isFuzzyMatch(token, normalizedPhrase));
};

const scoreIntent = (definition, normalizedText, rawText) => {
  let score = definition.priority || 0;
  let keywordHits = 0;
  let synonymHits = 0;
  let patternHits = 0;

  definition.keywords.forEach((keyword) => {
    if (phraseMatches(normalizedText, keyword)) {
      score += 2 + normalize(keyword).split(' ').length;
      keywordHits += 1;
    }
  });
  definition.synonyms.forEach((synonym) => {
    if (phraseMatches(normalizedText, synonym)) {
      score += 4;
      synonymHits += 1;
    }
  });
  definition.patterns.forEach((pattern) => {
    if (pattern.test(rawText)) {
      score += 10;
      patternHits += 1;
    }
  });

  if (
    definition.requiredAny.length
    && !definition.requiredAny.some((phrase) => phraseMatches(normalizedText, phrase))
  ) return 0;
  if (definition.requiresPattern && patternHits === 0) return 0;
  if (definition.keywords.length && keywordHits === 0) return 0;
  if (
    definition.keywords.length > 1
    && keywordHits < 2
    && synonymHits === 0
    && patternHits === 0
  ) return 0;

  return keywordHits || synonymHits || patternHits ? score : 0;
};

const enrichEntities = (intentId, text, entities) => {
  const updated = { ...entities };
  if (intentId === 'receivables.customer_outstanding' && !updated.customerName) {
    const match = text.match(/\b(?:outstanding|dues|balance)\s+(?:for|of)\s+(.+)$/i);
    if (match) updated.customerName = match[1].trim();
  }
  if (intentId === 'help.module') {
    const match = text.match(/\bhelp\s+(.+)$/i);
    if (match) updated.module = match[1].trim().toLowerCase();
  }
  return updated;
};

const parseMessage = (text) => {
  const rawText = String(text || '').trim();
  const normalizedText = normalize(rawText);
  const entities = extractEntities(rawText);

  if (!normalizedText) {
    return { intent: null, confidence: 0, entities, normalizedText };
  }

  const ranked = intents
    .map((definition) => ({
      definition,
      score: scoreIntent(definition, normalizedText, rawText)
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  if (!best || best.score < 2) {
    return { intent: null, confidence: 0, entities, normalizedText };
  }

  const enrichedEntities = enrichEntities(best.definition.id, rawText, entities);
  const missingEntities = best.definition.requiredEntities.filter((name) => !enrichedEntities[name]);

  return {
    intent: best.definition.id,
    mode: best.definition.mode,
    confidence: Math.min(best.score / 15, 1),
    entities: enrichedEntities,
    missingEntities,
    normalizedText,
    alternatives: ranked.slice(1, 3).map((result) => result.definition.id)
  };
};

module.exports = { parseMessage, normalize };
