const levenshteinDistance = (left, right) => {
  const a = String(left || '');
  const b = String(right || '');
  const rows = Array.from({ length: a.length + 1 }, () => []);
  for (let i = 0; i <= a.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return rows[a.length][b.length];
};

const isFuzzyMatch = (token, candidate) => {
  if (token.length < 5 || candidate.length < 5) return false;
  const maximumDistance = Math.max(token.length, candidate.length) >= 9 ? 2 : 1;
  return levenshteinDistance(token, candidate) <= maximumDistance;
};

module.exports = { levenshteinDistance, isFuzzyMatch };
