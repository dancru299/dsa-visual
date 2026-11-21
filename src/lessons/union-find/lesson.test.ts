import { describe, expect, test } from 'vitest';
import type { Frame } from '@/src/engine/types';
import {
  componentsBruteForce,
  groupsOf,
  heightOf,
  rootOf,
  type UFEvent,
  type UFState,
} from './algorithm';
import {
  BY_SIZE,
  CHAIN,
  CHAIN_N,
  CHAIN_PARENT,
  COMPRESS,
  ENTITY,
  FIND,
  FIND_X,
  FOREST,
  MATCHES,
  RECORDS,
  UNION,
  UNION_N,
  UNION_PAIRS,
  unionFindLesson,
} from './lesson';
import { BIG_HEIGHT, QUIZ_PARENT, QUIZ_ROOT, QUIZ_X } from './quiz';

type F = Frame<UFState, UFEvent>;
const { steps } = unionFindLesson;
const built = steps.map((s) => ({ step: s, frames: s.build() as Frame<unknown, unknown>[] }));
const answerOf = (f: Frame<unknown, unknown>) => f.ask!.choices[f.ask!.correct];
const onlyAsk = (frames: F[]) => {
  const asks = frames.filter((f) => f.ask);
  expect(asks).toHaveLength(1);
  return asks[0];
};

describe('bài Union-Find', () => {
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

  test('find: đáp án là gốc và số bước thật', () => {
    const f = onlyAsk(FIND);
    const root = FIND.find((x) => x.event.kind === 'root')!.event;
    expect(root.kind === 'root' && answerOf(f)).toBe(
      root.kind === 'root' && `Gốc ${root.root}, ${root.steps} bước`,
    );
    expect(root.kind === 'root' && root.root).toBe(rootOf(FOREST, FIND_X));
  });

  test('union: câu đoán ở lần gặp hai phần tử đã cùng nhóm, và kết quả đúng thành phần liên thông', () => {
    const f = onlyAsk(UNION);
    expect(f.event.kind).toBe('same');
    expect(groupsOf(UNION.at(-1)!.state.parent)).toEqual(
      componentsBruteForce(UNION_N, UNION_PAIRS),
    );
  });

  test('chuỗi: đáp án bằng số bước thật của find(0), và cây cao đúng n tầng', () => {
    const f = onlyAsk(CHAIN);
    expect(answerOf(f)).toBe(String(CHAIN_N - 1));
    expect(heightOf(CHAIN_PARENT)).toBe(CHAIN_N);
  });

  test('cây nhỏ vào cây lớn: đáp án gắn đúng gốc nhỏ hơn, và cây thấp hơn chuỗi', () => {
    const f = onlyAsk(BY_SIZE);
    const k = BY_SIZE.indexOf(f);
    expect(f.event.kind).toBe('link');
    if (f.event.kind === 'link') {
      const before = BY_SIZE[k - 1].state;
      expect(before.size[f.event.child]).toBeLessThan(before.size[f.event.parent]);
      expect(answerOf(f).startsWith(`Gắn ${f.event.child} vào dưới ${f.event.parent}`)).toBe(true);
    }
    expect(heightOf(BY_SIZE.at(-1)!.state.parent)).toBeLessThan(CHAIN_N);
  });

  test('nén đường: đáp án là gốc, và sau đó find(0) chỉ còn 1 bước', () => {
    const f = onlyAsk(COMPRESS);
    expect(f.event.kind === 'compress' && answerOf(f)).toBe(
      f.event.kind === 'compress' && String(f.event.root),
    );
    const last = COMPRESS.filter((x) => x.event.kind === 'root').at(-1)!.event;
    expect(last.kind === 'root' ? last.steps : -1).toBe(1);
  });

  test('gộp bản ghi: đáp án là số nhóm thật, khớp với cách gộp brute-force', () => {
    const f = onlyAsk(ENTITY);
    const direct: [number, number][] = [];
    RECORDS.forEach((x, i) =>
      RECORDS.forEach((y, j) => {
        if (i < j && (x.email === y.email || x.phone === y.phone)) direct.push([i, j]);
      }),
    );
    const groups = componentsBruteForce(RECORDS.length, direct);
    expect(answerOf(f)).toBe(String(groups.length));
    expect(groupsOf(ENTITY.at(-1)!.state.parent)).toEqual(groups);
    expect(MATCHES.length).toBeGreaterThan(0);
  });

  test('quiz: gốc và chiều cao tính từ code', () => {
    expect(rootOf(QUIZ_PARENT, QUIZ_X)).toBe(QUIZ_ROOT);
    expect(BIG_HEIGHT).toBe(10);
  });
});
