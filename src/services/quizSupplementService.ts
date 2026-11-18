/**
 * Supplements authored exercises so practice actually checks comprehension.
 *
 * Three gaps are closed here, all of them derived from the bundled stories and
 * dictionary rather than invented content:
 *
 * 1. Lessons with one or two authored questions could be "passed" by guessing,
 *    so every quiz is padded to a minimum length.
 * 2. Words taught in earlier lessons never came back, so nothing was recycled
 *    into long-term memory. Supplemental questions draw from the same level's
 *    story text, with earlier stories preferred.
 * 3. A wrong answer returned no explanation, only the answer string.
 *
 * Everything is deterministic for a given (story, profile) pair so a resumed
 * draft keeps scoring the same way.
 */

import type { QuizItem, Story } from '@/db';
import { allDictionary, getStories, type LevelNumber } from '@/data';
import { getDictionaryLookupForms, normalizeDictionaryWord } from '@/data/dictionary/wordForms';
import { seededShuffle } from '@/utils/quizPresentation';

export const MIN_QUESTIONS_PER_QUIZ = 4;

/** Questions added per quiz to re-test vocabulary from earlier lessons. */
export const RECYCLED_QUESTIONS = 2;

/**
 * Builds the context for one story. Earlier stories in the same level are listed
 * first so recycled words come from material the child has already met.
 */
export const buildSupplementContext = (story: Story, userId: string): SupplementContext => {
  const level = story.level as LevelNumber;
  const siblings = getStories(level)
    .filter(candidate => candidate.id !== story.id)
    .map(candidate => ({
      storyId: candidate.id,
      level: candidate.level,
      text: candidate.content.map(paragraph => paragraph.text).join(' '),
    }));
  return {
    storyId: story.id,
    level: story.level,
    storyText: story.content.map(paragraph => paragraph.text).join(' '),
    levelTexts: siblings,
    userId,
  };
};

/** Words that make poor meaning-recall questions even though they are in the text. */
const SKIPPED_MEANINGS = new Set([
  '的',
  '了',
  '地',
  '得',
  '和',
  '与',
  '在',
  '是',
  '有',
  '个',
  '这',
  '那',
  '他',
  '她',
  '它',
  '我',
  '你',
  '们',
  '一',
  '不',
]);

export interface SupplementContext {
  storyId: string;
  level: number;
  /** Text of every paragraph in the story, used to pull reviewable words. */
  storyText: string;
  /** Story texts ordered from earliest to latest within the level. */
  levelTexts: { storyId: string; level: number; text: string }[];
  /** Profile id: keeps the drawn question set stable across a resumed attempt. */
  userId: string;
}

const dictionaryIndex = new Map<string, (typeof allDictionary)[number]>();
for (const entry of allDictionary) {
  const key = normalizeDictionaryWord(entry.word);
  if (key && !dictionaryIndex.has(key)) dictionaryIndex.set(key, entry);
}

const lookupEntry = (word: string) => {
  for (const form of getDictionaryLookupForms(word)) {
    const entry = dictionaryIndex.get(form);
    if (entry) return entry;
  }
  return undefined;
};

/** Meaning quality gate: single Chinese words with a visualisable sense. */
const usableMeaning = (meaning: string): boolean => {
  const trimmed = meaning.trim();
  if (!trimmed || trimmed.length > 12) return false;
  if (SKIPPED_MEANINGS.has(trimmed)) return false;
  // Multi-sense glosses ("在……之上；一……就") are ambiguous as an answer option.
  return !/[；;、]/.test(trimmed);
};

/**
 * Function words make unusable meaning questions ("a 是什么意思？"). Kept in sync
 * with mistakeService so the generated quiz and the review queue agree on what
 * counts as real vocabulary.
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

const isQuizWord = (word: string): boolean =>
  Boolean(word) && !FUNCTION_WORDS.has(word.toLowerCase()) && word.length > 1;

const wordsIn = (text: string): string[] =>
  (text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).map(normalizeDictionaryWord).filter(Boolean);

const buildMeaningOptions = (answer: string, level: number, seed: string): string[] => {
  const pool = [
    ...new Set(
      allDictionary
        .filter(entry => entry.level <= level)
        .map(entry => entry.meaningCn)
        .filter(meaning => usableMeaning(meaning) && meaning !== answer)
    ),
  ];
  const distractors = seededShuffle(pool, `meaning:${seed}`).slice(0, 3);
  return seededShuffle([answer, ...distractors], `options:${seed}`);
};

/**
 * Builds a "what does this word mean?" question from the story's own vocabulary.
 * `preferWords` lets the caller put words the child got wrong first.
 */
export const buildMeaningQuestion = (
  word: string,
  context: SupplementContext,
  ordinal: number
): QuizItem | null => {
  const entry = lookupEntry(word);
  if (!entry || !usableMeaning(entry.meaningCn)) return null;
  const normalizedWord = normalizeDictionaryWord(entry.word);
  if (!normalizedWord || !isQuizWord(normalizedWord)) return null;

  const id = `${context.storyId}_auto_m${ordinal}_${normalizedWord}`;
  const options = buildMeaningOptions(entry.meaningCn, context.level, `${context.userId}:${id}`);
  return {
    id,
    type: 'fill_blank',
    question: `“${entry.word}” 是什么意思？`,
    blank: entry.word,
    options: options.map(text => ({ text, value: text })),
    correctAnswer: entry.meaningCn,
  };
};

/** Candidate review words: earlier stories first, then this story. */
const reviewCandidates = (context: SupplementContext): string[] => {
  const ordered = [
    ...context.levelTexts.filter(item => item.storyId !== context.storyId),
    { storyId: context.storyId, level: context.level, text: context.storyText },
  ];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of ordered) {
    for (const word of wordsIn(item.text)) {
      if (seen.has(word)) continue;
      seen.add(word);
      if (lookupEntry(word)) result.push(word);
    }
  }
  return result;
};

/**
 * Pads an authored quiz to `MIN_QUESTIONS_PER_QUIZ` with generated questions.
 *
 * Review words come from text the child has already met, so the added questions
 * recycle vocabulary instead of introducing new difficulty. Authored questions
 * always come first and are never rewritten.
 *
 * The result depends only on story data, never on mutable profile state: the
 * completion transaction rebuilds the same list to grade the attempt, so both
 * sides must agree without reading the database.
 */
export const withSupplementalQuestions = (
  authored: QuizItem[],
  context: SupplementContext
): QuizItem[] => {
  const authoredWords = new Set<string>();
  for (const question of authored) {
    for (const word of wordsIn(`${question.question} ${question.blank ?? ''}`)) {
      authoredWords.add(word);
    }
  }

  // Spaced recycling: every quiz re-tests a couple of words from earlier
  // lessons. Without this, 53% of the corpus appeared exactly once and nothing
  // was ever seen again after its own lesson.
  const recycled = reviewCandidates(context).filter(
    word => !authoredWords.has(normalizeDictionaryWord(word))
  );

  const generated: QuizItem[] = [];
  const target = Math.max(authored.length + RECYCLED_QUESTIONS, MIN_QUESTIONS_PER_QUIZ);
  for (const word of recycled) {
    if (authored.length + generated.length >= target) break;
    const question = buildMeaningQuestion(word, context, generated.length + 1);
    if (!question) continue;
    // Skip near-duplicate answers that would make two options identical.
    if (
      generated.some(
        item => item.correctAnswer === question.correctAnswer || item.blank === question.blank
      )
    ) {
      continue;
    }
    generated.push(question);
  }

  return [...authored, ...generated];
};
