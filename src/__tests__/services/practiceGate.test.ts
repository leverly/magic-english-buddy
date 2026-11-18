import { afterEach, describe, expect, it } from 'vitest';
import { db, type Story } from '@/db';
import { getLessonAccess, getPracticeAccess } from '@/services/learningCompletionService';

/**
 * Practising without reading was the fastest way to "clear" the curriculum:
 * `/quiz/:storyId` opened directly and a guessed answer unlocked the next level.
 */

const userId = 'gate-user';
const story: Story = {
  id: 'l1_gate',
  level: 1,
  regionId: 'region_l1',
  title: 'Gate Story',
  titleCn: '门禁故事',
  coverImage: '',
  audioFile: '',
  content: [],
  quiz: [{ id: 'q1', type: 'image_choice', question: 'apple', correctAnswer: 'apple' }],
  rewards: { magicPower: 10, cards: [] },
  metadata: { wordCount: 1, estimatedTime: 1, difficulty: 1 },
};

const seed = async () => {
  await db.userProgress.add({
    id: userId,
    level: 1,
    magicPower: 0,
    buddyStage: 1,
    totalReadingTime: 0,
    totalStoriesRead: 0,
    currentMapNode: 'node_gate',
    unlockedNodes: ['node_gate'],
    completedNodes: [],
    achievements: [],
    streakDays: 0,
    lastStudyDate: '',
  } as never);
  await db.stories.add(story);
  await db.mapNodes.add({
    id: 'node_gate',
    regionId: 'region_l1',
    type: 'story',
    storyId: story.id,
    position: { x: 0, y: 0 },
    prerequisites: [],
    rewards: { magicPower: 10 },
    unlocked: true,
    completed: false,
  } as never);
};

const recordReading = async (completed: boolean) => {
  await db.readingHistory.add({
    id: `reading-${completed}`,
    userId,
    storyId: story.id,
    startTime: Date.now() - 60_000,
    endTime: Date.now(),
    duration: 60,
    progress: completed ? 100 : 40,
    wordsLookedUp: [],
    shadowingRecords: [],
    completed,
  } as never);
};

describe('practice gate', () => {
  afterEach(async () => {
    await Promise.all([
      db.userProgress.clear(),
      db.stories.clear(),
      db.mapNodes.clear(),
      db.readingHistory.clear(),
      db.quizHistory.clear(),
    ]);
  });

  it('lets the reader open an unlocked lesson without practice history', async () => {
    await seed();
    const access = await getLessonAccess(userId, story.id);
    expect(access.allowed).toBe(true);
  });

  it('blocks practice before the story is read through', async () => {
    await seed();
    const access = await getPracticeAccess(userId, story.id);
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('not_read');
  });

  it('still blocks practice for a partially read story', async () => {
    await seed();
    await recordReading(false);
    const access = await getPracticeAccess(userId, story.id);
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('not_read');
  });

  it('opens practice after the story is finished', async () => {
    await seed();
    await recordReading(true);
    const access = await getPracticeAccess(userId, story.id);
    expect(access.allowed).toBe(true);
  });

  it('never revokes practice from a lesson already passed', async () => {
    await seed();
    await db.quizHistory.add({
      id: 'old-attempt',
      userId,
      storyId: story.id,
      quizType: 'story_quiz',
      questions: [],
      score: 100,
      earnedMagicPower: 10,
      completedAt: Date.now(),
    } as never);
    const access = await getPracticeAccess(userId, story.id);
    expect(access.allowed).toBe(true);
    expect(access.isReview).toBe(true);
  });

  it('keeps a genuinely locked lesson locked regardless of reading', async () => {
    await seed();
    // Nodes with no prerequisites are unlocked on purpose by mapProgressService,
    // so a second lesson behind the first is the real locked case.
    await db.mapNodes.add({
      id: 'node_gate_next',
      regionId: 'region_l1',
      type: 'story',
      storyId: 'l1_gate_next',
      position: { x: 1, y: 0 },
      prerequisites: ['node_gate'],
      rewards: { magicPower: 10 },
      unlocked: false,
      completed: false,
    } as never);
    await db.stories.add({ ...story, id: 'l1_gate_next' });
    await recordReading(true);

    const access = await getPracticeAccess(userId, 'l1_gate_next');
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('locked');
  });
});
