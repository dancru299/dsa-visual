import { describe, expect, test } from 'vitest';
import type { Frame } from '@/src/engine/types';
import { worstCaseBinary, type BSState } from '../binary-search/algorithm';
import type { GrowthState, JoinState } from './algorithm';
import { bigOLesson, CUSTOMERS, MISSING, ORDERS } from './lesson';

const { steps } = bigOLesson;
const built = steps.map((s) => ({ step: s, frames: s.build() as Frame<unknown, unknown>[] }));
const framesOf = <S>(id: string) => built.find((b) => b.step.id === id)!.frames as Frame<S>[];
const answerOf = (f: Frame<unknown>) => f.ask!.choices[f.ask!.correct];

describe('bài Big-O', () => {
  test('mỗi bước có ít nhất hai frame, id không trùng, frame đầu không có câu đoán', () => {
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    for (const { step, frames } of built) {
      expect(frames.length, step.id).toBeGreaterThan(1);
      expect(frames[0].ask, step.id).toBeUndefined();
    }
  });

  test('cả bài có ít nhất 3 câu đoán, mỗi câu có lựa chọn khác nhau', () => {
    const asks = built.flatMap(({ frames }) => frames.filter((f) => f.ask));
    expect(asks.length).toBeGreaterThanOrEqual(3);
    for (const f of asks) expect(new Set(f.ask!.choices).size).toBe(f.ask!.choices.length);
  });

  test('full scan: đáp án là số dòng thật sự phải đọc', () => {
    const frames = framesOf<BSState>('o-n');
    const ask = frames.find((f) => f.ask)!;
    expect(answerOf(ask)).toBe(String(frames.at(-1)!.state.comparisons));
    expect(frames.at(-1)!.state.result).toBe(-1);
  });

  test(`binary search tìm ${MISSING}: đáp án là số lần so sánh tệ nhất, và trace không vượt quá`, () => {
    const frames = framesOf<BSState>('o-log-n');
    const ask = frames.find((f) => f.ask)!;
    const n = frames[0].state.arr.length;
    expect(answerOf(ask)).toBe(String(worstCaseBinary(n)));
    expect(frames.at(-1)!.state.comparisons).toBeLessThanOrEqual(worstCaseBinary(n));
  });

  test('nested loop: đáp án là số cặp thật sự được so', () => {
    const frames = framesOf<JoinState>('o-n2');
    const ask = frames.find((f) => f.ask)!;
    expect(answerOf(ask)).toBe(String(frames.at(-1)!.state.comparisons));
    expect(frames.at(-1)!.state.comparisons).toBe(ORDERS.length * CUSTOMERS.length);
  });

  test('bảng tốc độ tăng: câu đoán nằm ở hàng 1 tỷ, đáp án là cột O(log n) của hàng đó', () => {
    const frames = framesOf<GrowthState>('tang-truong');
    const ask = frames.find((f) => f.ask)!;
    const row = ask.state.rows[ask.state.shown - 1];
    expect(row.n).toBe(1_000_000_000);
    expect(answerOf(ask)).toBe(String(row.log));
  });
});
