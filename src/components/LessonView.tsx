'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { feedbackUrl } from '@/src/config';
import { askKey, recordAnswer, recordQuiz, useAnswered, useQuizScore } from '@/src/engine/progress';
import type { Frame } from '@/src/engine/types';
import { useHashStep } from '@/src/engine/useHashStep';
import { lessonHref, nextBuiltLesson, type LessonEntry } from '@/src/lessons/catalog';
import { LESSONS } from '@/src/lessons';
import { cx } from '@/src/lib/cx';
import { Icon } from './Icon';
import { Quiz } from './Quiz';
import { Objectives, StepCard } from './StepCard';
import { StepPlayer } from './StepPlayer';
import { Stepper } from './Stepper';
import styles from './LessonView.module.css';

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable);

export function LessonView({ meta }: { meta: LessonEntry }) {
  const lesson = LESSONS[meta.slug];
  const { steps } = lesson;
  const router = useRouter();
  const [index, setIndex] = useHashStep(steps.length);
  const [maxSeen, setMaxSeen] = useState(0);
  const [speed, setSpeed] = useState(1);
  const answered = useAnswered(meta.slug);
  const quizScore = useQuizScore(meta.slug);
  const lessonRef = useRef<HTMLElement>(null);

  // Trace của mọi bước tính một lần khi mở bài. Mỗi bước chỉ vài chục frame nên rất nhẹ.
  const frames = useMemo(() => steps.map((s) => s.build() as Frame<unknown>[]), [steps]);
  const askKeys = useMemo(
    () => steps.flatMap((s, i) => frames[i].flatMap((f, j) => (f.ask ? [askKey(s.id, j)] : []))),
    [steps, frames],
  );
  const answeredCount = askKeys.filter((k) => answered.has(k)).length;
  const finished = askKeys.length > 0 && answeredCount === askKeys.length;

  const step = steps[index];
  const next = nextBuiltLesson(meta.slug);
  const last = index === steps.length - 1;
  const nextLabel = !last
    ? `Tiếp: ${steps[index + 1].short}`
    : next
      ? `Bài tiếp: ${next.title}`
      : 'Học lại từ đầu';

  const goTo = (i: number) => {
    const target = Math.max(0, Math.min(steps.length - 1, i));
    setIndex(target);
    setMaxSeen((m) => Math.max(m, target));
  };
  const goNext = () => {
    if (!last) goTo(index + 1);
    else if (next) router.push(lessonHref(next.slug));
    else goTo(0);
  };
  const goBack = () => goTo(index - 1);
  // Từ quiz quay lại một bước: mở bước đó rồi cuộn lên đầu phần bài học.
  const review = (i: number) => {
    goTo(i);
    lessonRef.current?.scrollIntoView({ block: 'start' });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.lesson} ref={lessonRef}>
            <header className={styles.lh}>
              <div>
                <div className={styles.crumb}>
                  {meta.module.name} &nbsp;/&nbsp;{' '}
                  <b>
                    Bài {meta.position} trong {meta.moduleSize}
                  </b>
                </div>
                <h1 className={styles.title}>{meta.title}</h1>
                <p className={styles.summary}>{meta.summary}</p>
              </div>
              <div className={styles.chips}>
                <span className={cx(styles.chip, styles.c1)}>
                  <Icon name="clock" size={13} />
                  {meta.minutes} phút
                </span>
                <span className={cx(styles.chip, styles.c2)}>
                  <Icon name="bars" size={13} />
                  {meta.level}
                </span>
                <span className={cx(styles.chip, styles.c3)}>
                  <Icon name="list" size={13} />
                  {steps.length} bước
                </span>
                <span
                  className={cx(styles.chip, finished ? styles.done : styles.c4)}
                  data-testid="progress-chip"
                >
                  <Icon name={finished ? 'check' : 'help'} size={13} />
                  {finished ? 'Đã xong bài' : `Câu đoán ${answeredCount}/${askKeys.length}`}
                </span>
                {quizScore && (
                  <span
                    className={cx(
                      styles.chip,
                      quizScore.best === quizScore.total ? styles.done : styles.c1,
                    )}
                    data-testid="quiz-chip"
                  >
                    <Icon name="check" size={13} />
                    Quiz {quizScore.best}/{quizScore.total}
                  </span>
                )}
              </div>
            </header>

            {meta.prerequisites && meta.prerequisites.length > 0 && (
              <div className={styles.prereq}>
                <b>CẦN BIẾT TRƯỚC</b>
                <ul>
                  {meta.prerequisites.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            <StepPlayer
              key={step.id}
              step={step}
              frames={frames[index]}
              legend={lesson.legend}
              speed={speed}
              onSpeed={setSpeed}
              onAnswer={(f) => recordAnswer(meta.slug, askKey(step.id, f))}
            />
          </section>

          <Stepper labels={steps.map((s) => s.short)} current={index} onSelect={goTo} />
        </div>

        <aside className={styles.panel} aria-label="Giải thích">
          <StepCard
            step={step}
            index={index}
            total={steps.length}
            frames={frames[index]}
            nextLabel={nextLabel}
            onBack={goBack}
            onNext={goNext}
            feedbackHref={feedbackUrl(meta.title)}
          />
          <Objectives items={lesson.objectives} reached={Math.max(maxSeen, index)} />
        </aside>
      </div>

      {/* Quiz nằm ngoài lưới hai cột: panel bên phải dính (sticky) trong phạm vi lưới, nếu quiz
          ở trong lưới thì panel sẽ trượt xuống đè lên quiz. */}
      <div className={styles.quizWrap}>
        <Quiz
          key={meta.slug}
          questions={lesson.quiz}
          stepLabels={steps.map((s) => s.short)}
          saved={quizScore}
          onFinish={(score) => recordQuiz(meta.slug, score, lesson.quiz.length)}
          onReview={review}
        />
      </div>
    </>
  );
}
