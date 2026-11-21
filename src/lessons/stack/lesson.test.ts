import { describe, expect, test } from 'vitest';
import type { Frame } from '@/src/engine/types';
import type { BracketEvent, BracketState, OpEvent, StackState } from './algorithm';
import { INVALID_TEXTS, stackLesson, VALID_TEXT } from './lesson';

const { steps } = stackLesson;
const built = steps.map((s) => ({ step: s, frames: s.build() as Frame<unknown, unknown>[] }));
const framesOf = (id: string) => built.find((b) => b.step.id === id)!.frames;

describe('bài Stack', () => {
  test('mỗi bước có ít nhất hai frame và id không trùng', () => {
    for (const { frames } of built) expect(frames.length).toBeGreaterThan(1);
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
  });

  test('frame đầu của mỗi bước không có câu đoán', () => {
    for (const { step, frames } of built) expect(frames[0].ask, step.id).toBeUndefined();
  });

  test('cả bài có ít nhất 3 câu đoán', () => {
    expect(
      built.flatMap(({ frames }) => frames.filter((f) => f.ask)).length,
    ).toBeGreaterThanOrEqual(3);
  });

  test('câu đoán của bước pop: đáp án là phần tử vừa được lấy ra', () => {
    for (const f of framesOf('pop') as Frame<StackState, OpEvent>[]) {
      if (!f.ask) continue;
      expect(f.event.kind).toBe('pop');
      if (f.event.kind === 'pop') expect(f.ask.choices[f.ask.correct]).toBe(f.event.item.label);
    }
  });

  test('câu đoán của bước ngoặc đúng: đáp án là đỉnh stack lúc so khớp', () => {
    const asks = (framesOf('ngoac-dung') as Frame<BracketState, BracketEvent>[]).filter(
      (f) => f.ask,
    );
    expect(asks.length).toBeGreaterThan(0);
    for (const f of asks) {
      expect(f.event.kind).toBe('compare');
      expect(f.ask!.choices[f.ask!.correct]).toBe(f.state.items.at(-1)!.label);
    }
  });

  test('câu đoán của bước ngoặc sai nằm ở chuỗi còn dư ngoặc mở', () => {
    const asks = (framesOf('ngoac-sai') as Frame<BracketState, BracketEvent>[]).filter(
      (f) => f.ask,
    );
    expect(asks.length).toBeGreaterThan(0);
    for (const f of asks) {
      expect(f.event.kind).toBe('leftover');
      expect(f.state.result).toBe(false);
      expect(f.ask!.choices[f.ask!.correct]).toMatch(/^Không/);
    }
  });

  test('câu đoán của bước call stack: đáp án là hàm ở đỉnh sau khi return', () => {
    for (const f of framesOf('call-stack') as Frame<StackState, OpEvent>[]) {
      if (!f.ask) continue;
      expect(f.event.kind).toBe('pop');
      expect(f.ask.choices[f.ask.correct]).toBe(f.state.items.at(-1)!.label);
    }
  });

  test('bước ngoặc sai đi qua đủ ba chuỗi, mỗi chuỗi kết thúc bằng False', () => {
    const frames = framesOf('ngoac-sai') as Frame<BracketState, BracketEvent>[];
    const ends = frames.filter((f) => f.state.result !== null && f.event.kind !== 'start');
    expect(ends.map((f) => f.state.text)).toEqual(INVALID_TEXTS);
    expect(ends.every((f) => f.state.result === false)).toBe(true);
  });

  test('bước ngoặc đúng kết thúc hợp lệ với stack rỗng', () => {
    const last = (framesOf('ngoac-dung') as Frame<BracketState, BracketEvent>[]).at(-1)!.state;
    expect(last.text).toBe(VALID_TEXT);
    expect(last.result).toBe(true);
    expect(last.items).toHaveLength(0);
  });

  // Các phần tử thuộc những chuỗi khác nhau phải có id khác nhau, nếu không Motion sẽ nhầm
  // khối của chuỗi trước với khối của chuỗi sau.
  test('id phần tử không lặp lại giữa các chuỗi trong cùng một bước', () => {
    const frames = framesOf('ngoac-sai') as Frame<BracketState, BracketEvent>[];
    const idsByText = new Map<string, Set<number>>();
    for (const f of frames) {
      const set = idsByText.get(f.state.text) ?? new Set<number>();
      f.state.items.forEach((x) => set.add(x.id));
      idsByText.set(f.state.text, set);
    }
    const all = [...idsByText.values()].flatMap((s) => [...s]);
    expect(new Set(all).size).toBe(all.length);
  });
});
