'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Ask } from '@/src/engine/types';
import { choiceOrder } from '@/src/lib/choiceOrder';
import { cx } from '@/src/lib/cx';
import { Button } from './Button';
import { Icon } from './Icon';
import styles from './AskCard.module.css';

export function AskCard({ ask, onContinue }: { ask: Ask; onContinue: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const shown = useMemo(() => choiceOrder(ask), [ask]);
  const id = useId();
  const answered = picked !== null;
  const choices = useRef<HTMLDivElement>(null);

  // Câu đoán hiện ra khi player dừng: đưa focus tới lựa chọn đầu tiên, để người dùng bàn phím
  // và trình đọc màn hình đi thẳng vào câu hỏi thay vì phải Tab tìm.
  useEffect(() => {
    choices.current?.querySelector('button')?.focus();
  }, []);

  return (
    <div className={styles.ask} role="group" aria-labelledby={id} data-testid="ask-card">
      <div className={styles.head}>
        <Icon name="help" size={14} />
        ĐOÁN TRƯỚC KHI XEM
      </div>
      <p id={id} className={styles.prompt}>
        {ask.prompt}
      </p>
      <div className={styles.choices} ref={choices}>
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
