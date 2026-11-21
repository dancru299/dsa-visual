'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { QuizScore } from '@/src/engine/progress';
import type { QuizQuestion } from '@/src/engine/types';
import { choiceOrder } from '@/src/lib/choiceOrder';
import { cx } from '@/src/lib/cx';
import { Button } from './Button';
import { CodeView } from './CodeView';
import { Icon } from './Icon';
import styles from './Quiz.module.css';

type Props = {
  questions: QuizQuestion[];
  stepLabels: string[];
  saved: QuizScore | null;
  onFinish: (score: number) => void; // gọi một lần, khi trả lời xong câu cuối cùng
  onReview: (step: number) => void;
};

// Quiz cuối bài: mọi câu hiện cùng lúc, mỗi câu chọn một lần rồi khoá lại và hiện lời giải.
// Trả lời sai thì có nút đưa về đúng bước cần xem lại.
export function Quiz({ questions, stepLabels, saved, onFinish, onReview }: Props) {
  const [picked, setPicked] = useState<(number | null)[]>(() => questions.map(() => null));
  const [round, setRound] = useState(0); // tăng mỗi lần làm lại, để các câu hiện lại từ đầu
  const titleId = useId();

  const answered = picked.filter((p) => p !== null).length;
  const score = picked.filter((p, i) => p === questions[i].correct).length;
  const complete = answered === questions.length;

  // Cập nhật theo state mới nhất, để hai lần bấm sát nhau không ghi đè lên nhau.
  const pick = (q: number, choice: number) =>
    setPicked((prev) => (prev[q] !== null ? prev : prev.map((p, i) => (i === q ? choice : p))));

  // Lưu điểm đúng một lần cho mỗi lượt làm, ngay khi câu cuối cùng được trả lời.
  const reported = useRef(-1);
  useEffect(() => {
    if (complete && reported.current !== round) {
      reported.current = round;
      onFinish(score);
    }
  }, [complete, round, score, onFinish]);

  const retry = () => {
    setPicked(questions.map(() => null));
    setRound((r) => r + 1);
  };

  return (
    <section className={styles.quiz} aria-labelledby={titleId} data-testid="quiz">
      <header className={styles.head}>
        <div>
          <div className={styles.kicker}>
            <Icon name="check" size={13} />
            KIỂM TRA CUỐI BÀI
          </div>
          <h2 id={titleId} className={styles.title}>
            {questions.length} câu, không có hình gợi ý
          </h2>
        </div>
        {saved && (
          <span className={styles.saved} data-testid="quiz-saved">
            Cao nhất: {saved.best}/{saved.total}
          </span>
        )}
      </header>

      <ol className={styles.list}>
        {questions.map((q, qi) => {
          const p = picked[qi];
          const right = p === q.correct;
          return (
            <li key={`${round}-${qi}`} className={styles.item} data-testid="quiz-question">
              <p className={styles.prompt}>
                <span className={styles.num}>{qi + 1}</span>
                {q.prompt}
              </p>
              {q.code && <CodeView file="quiz.py" lines={q.code} />}
              <div className={styles.choices} role="group" aria-label={`Đáp án câu ${qi + 1}`}>
                {choiceOrder(q).map((ci) => (
                  <button
                    key={ci}
                    type="button"
                    className={cx(
                      styles.choice,
                      p !== null && ci === q.correct && styles.right,
                      p !== null && ci === p && ci !== q.correct && styles.wrong,
                    )}
                    disabled={p !== null}
                    aria-pressed={p === ci}
                    onClick={() => pick(qi, ci)}
                    data-testid="quiz-choice"
                  >
                    {q.choices[ci]}
                  </button>
                ))}
              </div>
              {p !== null && (
                <div className={styles.feedback} aria-live="polite">
                  <p>
                    <b>{right ? 'Đúng.' : 'Chưa đúng.'}</b> {q.explain}
                  </p>
                  {!right && (
                    <button
                      type="button"
                      className={styles.review}
                      onClick={() => onReview(q.step)}
                      data-testid="quiz-review"
                    >
                      Xem lại bước {q.step + 1}: {stepLabels[q.step]}
                      <Icon name="right" size={13} />
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <footer className={styles.result} aria-live="polite" data-testid="quiz-result">
        {complete ? (
          <>
            <p>
              Bạn đúng <b>{score}</b> trên <b>{questions.length}</b> câu.{' '}
              {score === questions.length
                ? 'Bạn đã nắm chắc bài này.'
                : 'Xem lại các bước được gợi ý ở câu sai, rồi làm lại.'}
            </p>
            <Button onClick={retry} data-testid="quiz-retry">
              <Icon name="replay" size={14} />
              Làm lại
            </Button>
          </>
        ) : (
          <p>
            Đã trả lời {answered}/{questions.length} câu.
          </p>
        )}
      </footer>
    </section>
  );
}
