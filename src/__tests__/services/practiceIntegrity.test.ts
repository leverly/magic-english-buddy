import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { buildSupplementContext, withSupplementalQuestions } from '@/services/quizSupplementService';
import { shuffledUnlessIdentity } from '@/utils/quizPresentation';
import { mistakeWordFor, recordQuizMistakeInTransaction } from '@/services/mistakeService';
import { allStories, getStoryById } from '@/data';

/**
 * Regression guards for the practice-integrity work: guessing must not pass a
 * lesson, every quiz must be long enough to mean something, and mistakes must
 * reach the review queue.
 */

const storyOf = (id: string) => {
  const story = getStoryById(id);
  if (!story) throw new Error(`missing story ${id}`);
  return story;
};

const quizFor = (storyId: string, userId = 'integrity-user') =>
  withSupplementalQuestions(
    storyOf(storyId).quiz,
    buildSupplementContext(storyOf(storyId), userId)
  );

describe('practice integrity', () => {
  it('pads every bundled lesson to a meaningful question count', () => {
    const short = allStories
      .map(story => ({
        id: story.id,
        count: withSupplementalQuestions(
          story.quiz,
          buildSupplementContext(story, 'integrity-user')
        ).length,
      }))
      .filter(entry => entry.count < 4);
    expect(short).toEqual([]);
  });

  it('breaks the "always tap the first card" strategy', () => {
    // 87% of authored questions put the answer first. After ordering for
    // display, a fixed position must not clear the 60-point bar.
    let passing = 0;
    const attempts = allStories.length;
    for (const story of allStories) {
      const quiz = withSupplementalQuestions(
        story.quiz,
        buildSupplementContext(story, 'integrity-user')
      );
      const displayed = quiz.map(question => ({
        question,
        options: shuffledUnlessIdentity(
          question.options ?? [],
          `${question.id}:attempt`,
          option => option.value
        ),
      }));
      const firstCardHits = displayed.filter(
        ({ question, options }) => options[0]?.value === question.correctAnswer
      ).length;
      if (Math.round((firstCardHits / quiz.length) * 100) >= 60) passing += 1;
    }
    expect(passing / attempts).toBeLessThan(0.35);
  });

  it('never renders options in the authored order', () => {
    for (const story of allStories) {
      for (const question of story.quiz) {
        if (!question.options || question.options.length < 2) continue;
        const authored = question.options.map(option => option.value).join('|');
        const displayed = shuffledUnlessIdentity(
          question.options,
          `${question.id}:display`,
          option => option.value
        )
          .map(option => option.value)
          .join('|');
        expect(displayed).not.toBe(authored);
        expect(new Set(displayed.split('|')).size).toBe(question.options.length);
      }
    }
  });

  it('generates review questions for earlier-lesson vocabulary', () => {
    // The second L1 lesson must ask about words met before it, otherwise
    // nothing is ever recycled.
    const quiz = quizFor('l1_002');
    const generated = quiz.filter(question => question.id.includes('_auto_m'));
    expect(generated.length).toBeGreaterThan(0);
    expect(generated.every(question => Boolean(question.correctAnswer))).toBe(true);
  });

  it('is deterministic for the same profile so grading and display agree', () => {
    const first = quizFor('l1_001').map(question => question.id);
    const second = quizFor('l1_001').map(question => question.id);
    expect(first).toEqual(second);
  });

  describe('mistakes reach the review queue', () => {
    afterEach(async () => {
      await db.userVocabulary.clear();
      await db.dictionary.clear();
    });

    it('maps each question type to the word it tested', () => {
      expect(mistakeWordFor('apple')).toBe('apple');
      // Modals are grammar targets worth reviewing at L7.
      expect(mistakeWordFor('would', 'would')).toBe('would');
      expect(mistakeWordFor('苹果', 'apple')).toBe('apple');
      // Sentence-order answers are not single words.
      expect(mistakeWordFor('')).toBeNull();
    });

    it('never queues articles or pronouns as vocabulary', () => {
      // A review card asking "a 是什么意思？" teaches nothing and hides real words.
      for (const word of ['a', 'an', 'the', 'it', 'they', 'my']) {
        expect(mistakeWordFor(word, word)).toBeNull();
      }
    });

    it('creates a due-tomorrow entry with zero mastery', async () => {
      await db.dictionary.put({
        word: 'apple',
        phonetic: '/ˈæpl/',
        meaningCn: '苹果',
        meaningEn: 'a fruit',
        partOfSpeech: 'n.',
        examples: [],
        level: 1,
        frequency: 90,
      });

      const result = await recordQuizMistakeInTransaction('integrity-user', 'apples');
      expect(result).toMatchObject({ added: true, word: 'apple' });

      const row = await db.userVocabulary.get('integrity-user_apple');
      expect(row).toMatchObject({ masteryLevel: 0, wrongCount: 1 });
    });

    it('skips words with no dictionary entry instead of creating a dead card', async () => {
      const result = await recordQuizMistakeInTransaction('integrity-user', 'zzzznotaword');
      expect(result.added).toBe(false);
      expect(await db.userVocabulary.count()).toBe(0);
    });
  });
});
