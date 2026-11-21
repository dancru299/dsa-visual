import { describe, expect, test } from 'vitest';
import type { Frame } from '@/src/engine/types';
import { isHeap, kWayMerge, topK, type HeapEvent, type HeapState } from './algorithm';
import {
  AFTER_PUSH,
  AMOUNTS,
  CHECK,
  HEAP,
  heapLesson,
  K,
  KWAY,
  LISTS,
  POP,
  PUSH,
  PUSHED,
  RECAP,
  TOPK,
} from './lesson';

type F = Frame<HeapState, HeapEvent>;
const { steps } = heapLesson;
const built = steps.map((s) => ({ step: s, frames: s.build() as Frame<unknown, unknown>[] }));
const answerOf = (f: Frame<unknown, unknown>) => f.ask!.choices[f.ask!.correct];
const onlyAsk = (frames: F[]) => {
  const asks = frames.filter((f) => f.ask);
  expect(asks).toHaveLength(1);
  return asks[0];
};
const values = (f: F) => f.state.heap.map((n) => n.value);

describe('bài Heap', () => {
  test('mỗi bước có ít nhất hai frame, id không trùng, frame đầu không có câu đoán', () => {
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    for (const { step, frames } of built) {
      expect(frames.length, step.id).toBeGreaterThan(1);
      expect(frames[0].ask, step.id).toBeUndefined();
    }
    expect(built.flatMap((b) => b.frames.filter((f) => f.ask)).length).toBeGreaterThanOrEqual(3);
  });

  test('mọi câu đoán có lựa chọn không trùng nhau', () => {
    for (const { frames } of built)
      for (const f of frames.filter((x) => x.ask))
        expect(new Set(f.ask!.choices).size).toBe(f.ask!.choices.length);
  });

  test('cấu trúc: mảng ban đầu là heap, đáp án là hai con thật sự của node đang xét', () => {
    expect(isHeap(HEAP)).toBe(true);
    const f = onlyAsk(CHECK);
    expect(f.event.kind).toBe('check');
    if (f.event.kind === 'check') expect(answerOf(f)).toBe(f.event.children.join(' và '));
  });

  test('push: đáp án là index cuối cùng của số mới, và kết quả vẫn là heap', () => {
    const f = onlyAsk(PUSH);
    expect(f.event.kind).toBe('append');
    expect(isHeap(AFTER_PUSH)).toBe(true);
    expect(answerOf(f)).toBe(String(values(PUSH.at(-1)!).indexOf(PUSHED)));
    expect([...AFTER_PUSH].sort((a, b) => a - b)).toEqual([...HEAP, PUSHED].sort((a, b) => a - b));
  });

  test('pop: đáp án là con mà gốc thật sự đổi chỗ, và gốc mới là số nhỏ nhất còn lại', () => {
    const f = onlyAsk(POP);
    const k = POP.indexOf(f);
    expect(f.event.kind === 'compare' && f.event.dir).toBe('down');
    const next = POP[k + 1].event;
    expect(next.kind).toBe('swap');
    if (next.kind === 'swap') expect(answerOf(f)).toBe(String(values(POP[k + 1])[next.i]));
    const rest = [...AFTER_PUSH].sort((a, b) => a - b).slice(1);
    expect(POP.at(-1)!.state.out.map((n) => n.value)).toEqual([Math.min(...AFTER_PUSH)]);
    expect(isHeap(values(POP.at(-1)!))).toBe(true);
    expect(values(POP.at(-1)!)[0]).toBe(rest[0]);
  });

  test('Top-K: câu đoán ở lần bỏ qua đầu tiên, kết quả khớp với sort', () => {
    const f = onlyAsk(TOPK);
    expect(f.event.kind).toBe('skip');
    expect(answerOf(f).startsWith('Không')).toBe(true);
    expect(topK(AMOUNTS, K)).toEqual([...AMOUNTS].sort((a, b) => b - a).slice(0, K));
  });

  test('trộn k dãy: đáp án là số thật sự ra ở frame đó, và nó là số nhỏ nhất trong heap', () => {
    const f = onlyAsk(KWAY);
    const k = KWAY.indexOf(f);
    expect(f.event.kind).toBe('emit');
    if (f.event.kind === 'emit') {
      expect(answerOf(f).startsWith(`${f.event.value} `)).toBe(true);
      expect(f.event.value).toBe(Math.min(...values(KWAY[k - 1])));
    }
    expect(kWayMerge(LISTS)).toEqual(LISTS.flatMap((l) => l.values).sort((a, b) => a - b));
  });

  test('tóm tắt: một hàng cho mỗi số đến, theo đúng thứ tự', () => {
    const rows = RECAP.at(-1)!.state.rows;
    expect(rows.map((r) => Number(r[0]))).toEqual(AMOUNTS);
    expect(rows.filter((r) => r[1] === 'bỏ qua')).toHaveLength(TOPK.at(-1)!.state.skipped.length);
  });
});
