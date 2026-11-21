import { describe, expect, test } from 'vitest';
import type { Frame } from '@/src/engine/types';
import { BloomFilter, positionsOf } from './algorithm';
import {
  ABSENT,
  ABSENT_CHECK,
  ADD,
  ADDED,
  ASKED_BITS,
  bloomLesson,
  FALSE_CHECK,
  FALSE_POS,
  GROUPS,
  K,
  M,
  QUERY,
  REMOVE,
  REMOVED,
  SCAN,
  SIZE,
  SIZE_ROWS,
  TRUE_POS,
} from './lesson';
import { MEGABYTES } from './quiz';

const { steps } = bloomLesson;
const built = steps.map((s) => ({ step: s, frames: s.build() as Frame<unknown, unknown>[] }));
const answerOf = (f: Frame<unknown, unknown>) => f.ask!.choices[f.ask!.correct];
const onlyAsk = <S, E>(frames: Frame<S, E>[]) => {
  const asks = frames.filter((f) => f.ask);
  expect(asks).toHaveLength(1);
  return asks[0];
};
const filter = () => {
  const bf = new BloomFilter(M, K);
  ADDED.forEach((x) => bf.add(x));
  return bf;
};

describe('bài Bloom filter', () => {
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

  test('dữ liệu: mỗi phần tử dùng trong bài có K vị trí khác nhau, cho dễ theo dõi', () => {
    for (const x of [...ADDED, ABSENT, FALSE_POS, QUERY]) {
      expect(new Set(positionsOf(x, M, K)).size, x).toBe(K);
    }
  });

  test('dữ liệu: các tên được chọn cho đúng tình huống từng bước', () => {
    const bf = filter();
    expect(bf.mightContain(ABSENT)).toBe(false);
    expect(bf.mightContain(FALSE_POS)).toBe(true);
    expect(ADDED).not.toContain(FALSE_POS);
    expect(ADDED).toContain(TRUE_POS);
    const shared = positionsOf(TRUE_POS, M, K).filter((p) =>
      positionsOf(REMOVED, M, K).includes(p),
    );
    expect(shared.length).toBeGreaterThan(0);
  });

  test('thêm: câu đoán ở lần đầu một bit được bật lại', () => {
    const f = onlyAsk(ADD);
    expect(f.event.kind === 'set' && f.event.was).toBe(1);
    expect(answerOf(f)).toContain('vẫn là 1');
  });

  test('không có: câu đoán ở kết luận, và đó là "chắc chắn không có"', () => {
    const f = onlyAsk(ABSENT_CHECK);
    expect(f.event.kind === 'verdict' && f.event.verdict).toBe('absent');
    expect(answerOf(f).startsWith('Chắc chắn không có')).toBe(true);
  });

  test('dương tính giả: kết luận là "có thể có" cho phần tử chưa từng thêm', () => {
    const f = onlyAsk(FALSE_CHECK);
    expect(f.event.kind === 'verdict' && f.event.verdict).toBe('maybe');
    expect(f.event.kind === 'verdict' && f.event.truth).toBe(false);
    expect(answerOf(f).startsWith('Có thể có')).toBe(true);
  });

  test('không xoá được: sau khi tắt bit, filter bỏ sót phần tử có thật', () => {
    const f = onlyAsk(REMOVE);
    expect(f.event.kind === 'verdict' && f.event.verdict).toBe('absent');
    expect(f.event.kind === 'verdict' && f.event.truth).toBe(true);
    expect(answerOf(f).startsWith('Chắc chắn không có')).toBe(true);
  });

  test('kích thước: câu đoán ở hàng 10 bit, và tỉ lệ đo được dưới 1%', () => {
    const f = onlyAsk(SIZE);
    expect(f.state.rows.at(-1)![0]).toBe(String(ASKED_BITS));
    const r = SIZE_ROWS.find((x) => x.b === ASKED_BITS)!;
    expect(r.measured).toBeGreaterThan(0);
    expect(r.measured).toBeLessThan(0.01);
    expect(answerOf(f)).toBe('Dưới 1%');
    // Tỉ lệ sai giảm dần khi thêm bit.
    SIZE_ROWS.slice(1).forEach((x, i) => expect(x.formula).toBeLessThan(SIZE_ROWS[i].formula));
  });

  test('Parquet: đúng một row group có khoá, một row group dương tính giả, còn lại bỏ qua', () => {
    const owner = GROUPS.findIndex((g) => g.keys.includes(QUERY));
    expect(owner).toBeGreaterThanOrEqual(0);
    const reads = SCAN.filter((f) => f.event.kind === 'read').map((f) => f.event);
    expect(reads.filter((e) => e.kind === 'read' && e.found)).toHaveLength(1);
    expect(reads.filter((e) => e.kind === 'read' && !e.found)).toHaveLength(1);
    const f = onlyAsk(SCAN);
    expect(f.event.kind === 'check' && f.event.verdict).toBe('maybe');
  });

  test('quiz: bộ nhớ cho 10 triệu khoá, 10 bit mỗi khoá', () => {
    expect(MEGABYTES).toBe(12.5);
  });
});
