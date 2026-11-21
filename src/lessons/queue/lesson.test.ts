import { describe, expect, test } from 'vitest';
import type { Frame } from '@/src/engine/types';
import { tailOf, type RingEvent, type RingState } from './algorithm';
import { DEQUEUES, POP_LABELS, PRESSURE, queueLesson, SHIFTS, WRAP, WRAP_CAPACITY } from './lesson';

const { steps } = queueLesson;
const built = steps.map((s) => ({ step: s, frames: s.build() as Frame<unknown, unknown>[] }));
const answerOf = (f: Frame<unknown>) => f.ask!.choices[f.ask!.correct];
const askFrames = <S, E>(frames: Frame<S, E>[]) => frames.filter((f) => f.ask);

describe('bài Queue và ring buffer', () => {
  test('mỗi bước có ít nhất hai frame, id không trùng, frame đầu không có câu đoán', () => {
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    for (const { step, frames } of built) {
      expect(frames.length, step.id).toBeGreaterThan(1);
      expect(frames[0].ask, step.id).toBeUndefined();
    }
  });

  test('cả bài có ít nhất 3 câu đoán, lựa chọn trong mỗi câu không trùng', () => {
    const asks = built.flatMap(({ frames }) => askFrames(frames));
    expect(asks.length).toBeGreaterThanOrEqual(3);
    for (const f of asks) expect(new Set(f.ask!.choices).size).toBe(f.ask!.choices.length);
  });

  test('dequeue: đáp án là phần tử thật sự được lấy ra', () => {
    const [f] = askFrames(DEQUEUES);
    expect(f.event.kind).toBe('dequeue');
    if (f.event.kind === 'dequeue') expect(answerOf(f)).toBe(f.event.item.label);
  });

  test('pop(0): đáp án là số lần dời ở cuối trace, bằng n - 1', () => {
    const [f] = askFrames(SHIFTS);
    expect(answerOf(f)).toBe(String(SHIFTS.at(-1)!.state.moves));
    expect(SHIFTS.at(-1)!.state.moves).toBe(POP_LABELS.length - 1);
  });

  test('ring buffer: câu đoán nằm ở lần ghi vào ô 0 sau khi quay vòng', () => {
    const asks = askFrames(WRAP as Frame<RingState, RingEvent>[]);
    expect(asks).toHaveLength(1);
    const f = asks[0];
    expect(f.event.kind).toBe('put');
    if (f.event.kind === 'put') expect(answerOf(f)).toBe(String(f.event.slot));
    // Frame ngay trước đó vừa ghi vào ô cuối, nên tail đang là 0.
    const k = WRAP.indexOf(f);
    expect(tailOf(WRAP[k - 1].state)).toBe(0);
    expect(WRAP_CAPACITY - 1).toBe((WRAP[k - 1].event as { slot: number }).slot);
  });

  test('backpressure: câu đoán nằm ở lần put bị chặn vì đầy', () => {
    const asks = askFrames(PRESSURE);
    expect(asks.length).toBeGreaterThan(0);
    for (const f of asks) {
      expect(f.event.kind).toBe('full');
      expect(f.state.size).toBe(f.state.capacity);
      expect(f.state.waiting).not.toBeNull();
      expect(answerOf(f)).toMatch(/^Chờ/);
    }
  });

  test('sau khi chờ, producer ghi được đúng event đã phải chờ', () => {
    const full = PRESSURE.find((f) => f.event.kind === 'full')!;
    const last = PRESSURE.at(-1)!;
    expect(last.event.kind).toBe('put');
    if (full.event.kind === 'full' && last.event.kind === 'put') {
      expect(last.event.item.id).toBe(full.event.item.id);
    }
    expect(last.state.waiting).toBeNull();
  });
});
