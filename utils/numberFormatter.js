// Ceil a numeric value to two decimal places without converting to string
function ceilToTwoDecimals(value) {
  if (typeof value !== 'number' || !isFinite(value)) return value;
  // Leave integers unchanged
  if (Number.isInteger(value)) return value;
  // Avoid floating point artifacts like 120.00000000000001 for 1.2*100
  const scaled = Math.ceil((value * 100) - 1e-10);
  // Ensure representation has at most 2 decimals (remove binary float noise)
  return Number((scaled / 100).toFixed(2));
}

// Recursively traverse objects/arrays and ceil numeric values to two decimals
function toPlainObject(value) {
  if (value && typeof value.toJSON === 'function') {
    try {
      return value.toJSON();
    } catch (_) {
      // fall through
    }
  }
  return value;
}

function isMongooseObjectId(value) {
  return value && typeof value === 'object' && value.constructor && value.constructor.name === 'ObjectId';
}

function formatNumbersDeep(input, seen = new WeakSet()) {
  // Primitive values and null
  if (input === null || typeof input !== 'object') {
    return typeof input === 'number' ? ceilToTwoDecimals(input) : input;
  }

  // Avoid circular references
  if (seen.has(input)) return input;
  seen.add(input);

  // Dates remain as-is
  if (input instanceof Date) return input;

  // Buffers remain as-is
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(input)) {
    return input;
  }

  // Mongoose ObjectId (leave as-is)
  if (isMongooseObjectId(input)) {
    return input;
  }

  // Arrays
  if (Array.isArray(input)) {
    return input.map((item) => formatNumbersDeep(toPlainObject(item), seen));
  }

  // Plain objects
  const source = toPlainObject(input);
  const output = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (typeof value === 'number') {
      output[key] = ceilToTwoDecimals(value);
    } else {
      output[key] = formatNumbersDeep(toPlainObject(value), seen);
    }
  }
  return output;
}

module.exports = {
  ceilToTwoDecimals,
  formatNumbersDeep,
};


