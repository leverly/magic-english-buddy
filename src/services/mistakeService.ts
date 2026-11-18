/**
 * Quiz mistakes flow into the spaced-repetition pool.
 *
 * Before this, `userVocabulary` was only written when a child manually saved a
 * word from the dictionary or cleared a lesson for the first time. Answering a
 * question wrong — the clearest evidence a word needs review — left no trace,
 * so the review queue never contained the words that actually caused trouble.
 */

import { db } from '@/db';
import { getDictionaryLookupForms, normalizeDictionaryWord } from '@/data/dictionary/wordForms';
import { localDate } from '@/utils/localDate';

/**
 * Function words are not reviewable vocabulary: a child cannot "learn" `a` or
 * `the` from a flashcard, and a queue full of them hides the real words.
 * Answering an article question wrong is a grammar slip, not a vocabulary gap.
 */
const FUNCTION_WORDS = new Set([
  'a', 'an', 'the',
  'and', 'or', 'but', 'if',
  'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'as',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did',
  'have', 'has', 'had',
  'it', 'its', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'we', 'they',
  'me', 'him', 'us', 'them',
  'my', 'your', 'his', 'our', 'their',
  'so', 'no', 'yes',
]);

/** Whether a single English word is worth putting in the review queue. */
export const isReviewableWord = (word: string): boolean =>
  Boolean(word) && !FUNCTION_WORDS.has(word.toLowerCase());

/**
 * Maps a submitted answer back to the word it tested.
 *
 * Authored items encode it differently per type: `blank` holds the missing word
 * for fill-in-the-blank, `correctAnswer` holds the word for image choice and word
 * builder, and sentence order tests no single word. Generated meaning questions
 * carry the tested word in `blank` as well.
 */
export const mistakeWordFor = (correctAnswer: string, blank?: string): string | null => {
  const source = (blank ?? '').trim() || (typeof correctAnswer === 'string' ? correctAnswer : '');
  const word = normalizeDictionaryWord(source);
  // Meaning questions store a Chinese gloss in correctAnswer; those are skipped
  // here because their `blank` already holds the English word.
  if (!word || !/[a-z]/i.test(word)) return null;
  // Sentence-level answers arrive as multiple words; only single words are reviewable.
  if (/\s/.test(source.trim())) return null;
  return isReviewableWord(word) ? word : null;
};

export interface RecordMistakeResult {
  added: boolean;
  word: string;
}

/**
 * Adds (or re-arms) one missed word in the review queue.
 *
 * A wrong answer resets mastery to 0 and schedules review for tomorrow, which
 * matches how a failed review already behaves. Existing cards keep their
 * collection state; only scheduling changes.
 */
export const recordQuizMistakeInTransaction = async (
  userId: string,
  word: string,
  now = Date.now()
): Promise<RecordMistakeResult> => {
  const candidateForms = getDictionaryLookupForms(word);
  let entry;
  for (const form of candidateForms) {
    entry = await db.dictionary.get(form);
    if (entry) break;
  }
  // Words absent from the dictionary cannot be reviewed (no gloss to ask for),
  // so they are skipped rather than creating an unanswerable card.
  if (!entry) return { added: false, word };

  const normalizedWord = normalizeDictionaryWord(entry.word);
  if (!normalizedWord) return { added: false, word };
  if (!isReviewableWord(normalizedWord)) return { added: false, word };
  const vocabId = `${userId}_${normalizedWord}`;
  const existing = await db.userVocabulary.get(vocabId);

  if (existing) {
    await db.userVocabulary.update(vocabId, {
      // Leaving the card flag, rarity and counters untouched keeps collection
      // progress honest; a mistake only affects when it comes back.
      masteryLevel: 0,
      wrongCount: existing.wrongCount + 1,
      nextReviewDate: localDate(now, 1),
    });
    return { added: true, word: normalizedWord };
  }

  await db.userVocabulary.add({
    id: vocabId,
    userId,
    word: normalizedWord,
    firstSeen: now,
    lastReviewed: 0,
    correctCount: 0,
    wrongCount: 1,
    masteryLevel: 0,
    nextReviewDate: localDate(now, 1),
    isCard: false,
    cardRarity: null,
  });
  return { added: true, word: normalizedWord };
};
