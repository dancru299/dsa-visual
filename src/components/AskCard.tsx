'use client';

import { useId, useMemo, useState } from 'react';
import type { Ask } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import { Button } from './Button';
import { Icon } from './Icon';
import styles from './AskCard.module.css';

// Xáo thứ tự đáp án nhưng cố định theo nội dung câu hỏi, để lần render nào cũng giống nhau
// và đáp án đúng không luôn nằm ở cùng một chỗ.
function order(ask: Ask): number[] {
  const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return ask.choices
    .map((c, i) => ({ i, h: hash(ask.prompt + '|' + c) }))
    .sort((a, b) => a.h - b.h)
    .map((x) => x.i);
}

export function AskCard({ ask, onContinue }: { ask: Ask; onContinue: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const shown = useMemo(() => order(ask), [ask]);
  const id = useId();
  const answered = picked !== null;

  return (
    <div className={styles.ask} role="group" aria-labelledby={id} data-testid="ask-card">
      <div className={styles.head}>
        <Icon name="help" size={14} />
        ĐOÁN TRƯỚC KHI XEM
      </div>
      <p id={id} className={styles.prompt}>
        {ask.prompt}
      </p>
      <div className={styles.choices}>
        {shown.map((i) => (
          <button
            key={i}
            type="button"
            className={cx(
              styles.choice,
              answered && i === ask.correct && styles.right,
              answered && i === picked && i !== ask.correct && styles.wrong,
            )}
            disabled={answered}
            onClick={() => setPicked(i)}
            data-testid="ask-choice"
          >
            {ask.choices[i]}
          </button>
        ))}
      </div>
      {answered && (
        <div className={styles.feedback} aria-live="polite">
          <p>
            <b>{picked === ask.correct ? 'Đúng rồi.' : 'Chưa đúng.'}</b> {ask.explain}
          </p>
          <Button variant="primary" onClick={onContinue} autoFocus data-testid="ask-continue">
            Xem tiếp
            <Icon name="right" size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
