/**
 * Presentation-order helpers for quiz items.
 *
 * Authored exercises place the correct option first in 87% of questions, which
 * turns "always tap the first card" into a winning strategy. Options and
 * word-builder letters are therefore ordered per attempt at render time. The
 * order is stable inside one attempt (so feedback never reshuffles the cards the
 * child just tapped) and independent of `Math.random`, so a resumed draft shows
 * the same layout.
 */

/** FNV-1a: small, dependency-free, and stable across runs. */
const hash = (value: string): number => {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return result >>> 0;
};

/** Deterministic permutation: same (items, seed) always yields the same order. */
export const seededShuffle = <T>(items: readonly T[], seed: string): T[] => {
  const result = [...items];
  let state = hash(seed) || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    // xorshift32 keeps the sequence cheap and repeatable.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    const swap = state % (index + 1);
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
};

/**
 * A permutation that never returns the authored order. A child who has already
 * memorised "the answer is the left card" must re-read the question.
 */
export const shuffledUnlessIdentity = <T>(
  items: readonly T[],
  seed: string,
  keyOf: (item: T) => string
): T[] => {
  if (items.length < 2) return [...items];
  const original = items.map(keyOf).join('\u0001');
  for (let salt = 0; salt < 8; salt += 1) {
    const candidate = seededShuffle(items, `${seed}#${salt}`);
    if (candidate.map(keyOf).join('\u0001') !== original) return candidate;
  }
  // Reversal is always available for length >= 2 and never equals the original
  // here (the loop above only exhausts when every key is identical).
  return [...items].reverse();
};
