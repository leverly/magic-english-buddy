/**
 * QuizFeedback 组件
 * 正确/错误反馈动画
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { QuizItem, Story } from '@/db';
import { isTTSAbortError, ttsService } from '@/services/ttsService';
import {
  buildAnswerExplanation,
  type AnswerExplanation,
} from '@/services/answerExplanationService';
import styles from './QuizFeedback.module.css';

interface QuizFeedbackProps {
  isCorrect: boolean;
  correctAnswer: string;
  onContinue: () => void;
  /** The question just answered, used to explain a wrong answer. */
  question?: QuizItem;
  /** The story the question came from; supplies a replayable example sentence. */
  story?: Story;
}

export const QuizFeedback: React.FC<QuizFeedbackProps> = ({
  isCorrect,
  correctAnswer,
  onContinue,
  question,
  story,
}) => {
  // The gloss is resolved from the bundled dictionary in memory, so it is
  // available on the same frame as the wrong-answer card — no empty placeholder.
  const explanation = useMemo<AnswerExplanation | null>(() => {
    if (isCorrect || !question) return null;
    try {
      return buildAnswerExplanation(question, story);
    } catch {
      return null;
    }
  }, [isCorrect, question, story]);

  useEffect(
    () => () => {
      ttsService.stop('quiz');
    },
    []
  );

  const [isReplaying, setIsReplaying] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  const replaySentence = useCallback(async () => {
    const sentence = explanation?.sourceSentence;
    if (!sentence || isReplaying) return;
    setReplayError(null);
    setIsReplaying(true);
    try {
      ttsService.setRate(0.8);
      await ttsService.speak(sentence, { owner: 'quiz' });
    } catch (error) {
      if (!isTTSAbortError(error)) setReplayError('这句暂时读不出来，请再看一遍文字。');
    } finally {
      setIsReplaying(false);
    }
  }, [explanation?.sourceSentence, isReplaying]);

  return (
    <motion.div
      className={`${styles.container} ${isCorrect ? styles.correct : styles.wrong}`}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* 图标 */}
      <motion.div
        className={styles.icon}
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 400 }}
      >
        {isCorrect ? '🎉' : '😅'}
      </motion.div>

      {/* 标题 */}
      <motion.h2
        className={styles.title}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {isCorrect ? '太棒了！' : '继续加油！'}
      </motion.h2>

      {/* 描述 */}
      <motion.p
        className={styles.description}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {isCorrect ? '你的魔力值 +3 ✨' : `正确答案是：${correctAnswer}`}
      </motion.p>

      {/* 答错后的解释：词义 + 课文原句（可重听） */}
      {/* 答错后的解释：词义 + 课文原句（可重听）。
          The gloss comes from IndexedDB and resolves asynchronously, so a
          placeholder keeps the card from looking empty while it loads. */}
      {!isCorrect && (
        <motion.div
          className={styles.explanation}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          {explanation?.meaningCn ? (
            <p className={styles.gloss}>
              <strong lang="en">{explanation.word}</strong>
              {explanation.partOfSpeech && (
                <span className={styles.pos}>{explanation.partOfSpeech}</span>
              )}
              <span className={styles.meaning}>{explanation.meaningCn}</span>
            </p>
          ) : (
            <p className={styles.glossLoading}>这个词暂时没有释义。</p>
          )}
          {explanation?.sourceSentence && (
            <div className={styles.sentence}>
              <p className={styles.sentenceEn} lang="en">
                {explanation.sourceSentence}
              </p>
              {explanation.sourceSentenceCn && (
                <p className={styles.sentenceCn}>{explanation.sourceSentenceCn}</p>
              )}
              <button
                type="button"
                className={styles.replayBtn}
                onClick={() => void replaySentence()}
                disabled={isReplaying}
              >
                {isReplaying ? '🔊 正在读…' : '🔈 再听一遍这句'}
              </button>
              {replayError && (
                <p className={styles.replayError} role="alert">
                  {replayError}
                </p>
              )}
            </div>
          )}
          <p className={styles.mistakeNote}>提交练习后，这个词会进入生词复习。</p>
        </motion.div>
      )}

      {/* 粒子效果 (仅正确时) */}
      {isCorrect && (
        <div className={styles.particles}>
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className={styles.particle}
              initial={{
                x: 0,
                y: 0,
                scale: 0,
              }}
              animate={{
                x: (Math.random() - 0.5) * 200,
                y: (Math.random() - 0.5) * 200,
                scale: [0, 1, 0],
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: 1,
                delay: Math.random() * 0.3,
              }}
            >
              {['⭐', '✨', '💫', '🌟'][i % 4]}
            </motion.div>
          ))}
        </div>
      )}

      {/* 点击继续 */}
      <motion.button
        className={styles.continueBtn}
        onClick={onContinue}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        继续 →
      </motion.button>
    </motion.div>
  );
};

export default QuizFeedback;
