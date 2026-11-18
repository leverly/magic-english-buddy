/**
 * Turns a wrong answer into something a child can learn from.
 *
 * The feedback screen used to show only `正确答案是：X`. That is the moment with
 * the highest instructional value in the whole loop, so it now carries the
 * word's Chinese gloss, its part of speech, and the sentence from the story the
 * question was drawn from — which can be replayed from the pre-generated audio.
 */

import type { QuizItem, Story } from '@/db';
import { allDictionary } from '@/data';
import { getDictionaryLookupForms, normalizeDictionaryWord } from '@/data/dictionary/wordForms';

export interface AnswerExplanation {
  /** The English word or phrase the question tested, when there is one. */
  word: string | null;
  /** Chinese gloss of that word. */
  meaningCn: string | null;
  partOfSpeech: string | null;
  meaningEn: string | null;
  /** A sentence from the story containing the answer, replayable as audio. */
  sourceSentence: string | null;
  /** Chinese translation of `sourceSentence`. */
  sourceSentenceCn: string | null;
}

const EMPTY: AnswerExplanation = {
  word: null,
  meaningCn: null,
  partOfSpeech: null,
  meaningEn: null,
  sourceSentence: null,
  sourceSentenceCn: null,
};

const EMPTY_MEANINGS = new Set(['', '?']);

/** Bundled dictionary indexed in memory so feedback never waits on IndexedDB. */
const bundledIndex = new Map<string, (typeof allDictionary)[number]>();
for (const entry of allDictionary) {
  const key = normalizeDictionaryWord(entry.word);
  if (key && !bundledIndex.has(key)) bundledIndex.set(key, entry);
}

const lookupBundled = (word: string) => {
  for (const form of getDictionaryLookupForms(word)) {
    const entry = bundledIndex.get(form);
    if (entry && entry.meaningCn && !EMPTY_MEANINGS.has(entry.meaningCn.trim())) return entry;
  }
  return undefined;
};

/** The English word a question is really about, per question type. */
export const testedWordOf = (question: QuizItem): string | null => {
  if (question.type === 'sentence_order') return null;
  const raw = question.blank?.trim() || question.correctAnswer?.trim() || '';
  if (!raw || !/[a-z]/i.test(raw) || /\s/.test(raw)) return null;
  return normalizeDictionaryWord(raw);
};

const findSourceSentence = (
  story: Story | undefined,
  word: string
): { text: string; translation: string | null } | null => {
  if (!story) return null;
  const forms = new Set(getDictionaryLookupForms(word));
  for (const paragraph of story.content) {
    const tokens = (paragraph.text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).map(
      normalizeDictionaryWord
    );
    if (tokens.some(token => forms.has(token))) {
      // Split into sentences so the replay is one line, not a whole paragraph.
      const sentences = paragraph.text.split(/(?<=[.!?])\s+/);
      const matched = sentences.find(sentence =>
        (sentence.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [])
          .map(normalizeDictionaryWord)
          .some(token => forms.has(token))
      );
      return { text: matched ?? paragraph.text, translation: paragraph.translation ?? null };
    }
  }
  return null;
};

export const buildAnswerExplanation = (
  question: QuizItem,
  story?: Story
): AnswerExplanation => {
  if (question.type === 'sentence_order') {
    // Word order is the lesson; the story sentence is the reference answer.
    const sentence = (question.correctOrder ?? []).join(' ');
    const source = findSourceSentence(story, normalizeDictionaryWord(sentence.split(/\s+/)[0] ?? ''));
    return {
      ...EMPTY,
      word: sentence || null,
      sourceSentence: source?.text ?? null,
      sourceSentenceCn: source?.translation ?? null,
    };
  }

  const word = testedWordOf(question);
  if (!word) return { ...EMPTY, word: question.correctAnswer ?? null };

  const entry = lookupBundled(word);
  const source = findSourceSentence(story, word);
  return {
    word: entry?.word ?? word,
    meaningCn: entry?.meaningCn ?? null,
    partOfSpeech: entry?.partOfSpeech ?? null,
    meaningEn: entry?.meaningEn ?? null,
    sourceSentence: source?.text ?? null,
    sourceSentenceCn: source?.translation ?? null,
  };
};
