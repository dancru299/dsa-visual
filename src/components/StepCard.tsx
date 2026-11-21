import type { Callout, Frame, Metric, Step } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import styles from './StepCard.module.css';

const CALLOUT_ICON: Record<Callout['kind'], IconName> = {
  warn: 'alert',
  key: 'bulb',
  de: 'db',
  think: 'help',
};

// "Thay đổi" của bước: những số liệu khác nhau giữa frame đầu và frame cuối.
function metricChanges(frames: Frame<unknown>[]): string[] {
  const first = new Map((frames[0]?.metrics ?? []).map((m: Metric) => [m.label, m.value]));
  return (frames.at(-1)?.metrics ?? []).flatMap((m) => {
    const before = first.get(m.label);
    return before !== undefined && before !== m.value ? [`${m.label}: ${before} → ${m.value}`] : [];
  });
}

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  step: Step<any, any>;
  index: number;
  total: number;
  frames: Frame<unknown>[];
  nextLabel: string;
  onBack: () => void;
  onNext: () => void;
  feedbackHref: string;
};

export function StepCard({
  step,
  index,
  total,
  frames,
  nextLabel,
  onBack,
  onNext,
  feedbackHref,
}: Props) {
  const { Body, callout } = step;
  const changes = metricChanges(frames);
  return (
    <section className={styles.card} data-testid="step-card">
      <div className={styles.head}>
        <span data-testid="step-counter">
          BƯỚC {index + 1} / {total}
        </span>
        <span className={cx(styles.tag, styles[step.tone])}>{step.tag}</span>
      </div>
      <h2 className={styles.title} aria-live="polite">
        {step.title}
      </h2>
      <div className={styles.body}>
        <Body frames={frames} />
      </div>
      {callout && (
        <div className={cx(styles.callout, styles[callout.kind])}>
          <Icon name={CALLOUT_ICON[callout.kind]} size={16} />
          <div>
            <b className={styles.ct}>{callout.title}</b>
            {callout.text}
            {callout.answer && (
              <details>
                <summary>Xem đáp án</summary>
                {callout.answer}
              </details>
            )}
          </div>
        </div>
      )}
      {changes.length > 0 && (
        <div className={styles.changes}>
          <h3>THAY ĐỔI</h3>
          <ul>
            {changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      <div className={styles.nav}>
        <Button onClick={onBack} disabled={index === 0}>
          <Icon name="left" size={14} />
          Lùi
        </Button>
        <Button variant="primary" className={styles.next} onClick={onNext} data-testid="step-next">
          <span>{nextLabel}</span>
          <Icon name="right" size={14} />
        </Button>
      </div>
      <div className={styles.keys}>
        <kbd>←</kbd>
        <kbd>→</kbd> chuyển bước · <kbd>R</kbd> xem lại · <kbd>Space</kbd> tạm dừng
      </div>
      <a className={styles.feedback} href={feedbackHref} target="_blank" rel="noopener noreferrer">
        <Icon name="message" size={13} />
        Chỗ nào khó hiểu? Góp ý cho bài này
      </a>
    </section>
  );
}

export function Objectives({
  items,
  reached,
}: {
  items: { text: string; step: number }[];
  reached: number;
}) {
  return (
    <section className={cx(styles.card, styles.learn)}>
      <h3>BẠN SẼ HỌC</h3>
      <ul>
        {items.map((o) => (
          <li key={o.text} className={cx(reached >= o.step && styles.ok)}>
            <span className={styles.box} />
            <span>{o.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
