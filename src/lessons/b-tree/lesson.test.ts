import { describe, expect, test } from 'vitest';
import type { Frame } from '@/src/engine/types';
import {
  build,
  heightOf,
  isBTree,
  minHeight,
  MAX_KEYS,
  type BEvent,
  type BState,
} from './algorithm';
import { layout } from './layout';
import {
  ADDED,
  BASE,
  btreeLesson,
  CASCADE,
  CASCADED,
  FANOUT,
  FANOUT_ROWS,
  HEIGHT_AFTER_SORTED,
  INSERT,
  PAGES,
  RECAP,
  SEARCH,
  SORTED,
  SORTED_KEYS,
  TARGET,
} from './lesson';
import { CHILD, LEAF, LOOK_FOR, NEW_KEY, NODE_KEYS, PROMOTED } from './quiz';

type F = Frame<BState, BEvent>;
const { steps } = btreeLesson;
const built = steps.map((s) => ({ step: s, frames: s.build() as Frame<unknown, unknown>[] }));
const answerOf = (f: Frame<unknown, unknown>) => f.ask!.choices[f.ask!.correct];
const onlyAsk = <S, E>(frames: Frame<S, E>[]) => {
  const asks = frames.filter((f) => f.ask);
  expect(asks).toHaveLength(1);
  return asks[0];
};
const levels = (f: F) => layout(f.state.root, f.state.nodes).levels;

describe('bài B-tree', () => {
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

  test('dữ liệu: cây ban đầu và mọi cây sau khi chèn đều là B-tree', () => {
    expect(isBTree(build(BASE))).toBe(true);
    expect(isBTree(build([...BASE, ADDED]))).toBe(true);
    expect(isBTree(build([...BASE, ADDED, ...CASCADE]))).toBe(true);
  });

  test('tìm: câu đoán ở gốc, đáp án là đúng con mà đường đi xuống', () => {
    const f = onlyAsk(SEARCH);
    const k = SEARCH.indexOf(f);
    expect(f.event.kind).toBe('scan');
    if (f.event.kind === 'scan') {
      expect(f.event.node).toBe(f.state.root);
      expect(answerOf(f).startsWith(`Con thứ ${f.event.slot + 1}:`)).toBe(true);
      const root = f.state.nodes.find((n) => n.id === f.state.root)!;
      const next = SEARCH[k + 1].event;
      expect(next.kind === 'scan' && next.node).toBe(root.children[f.event.slot]);
    }
    expect(SEARCH.some((x) => x.event.kind === 'found' && x.event.key === TARGET)).toBe(true);
  });

  test('chèn: câu đoán ở lá tràn, và frame sau đó là tách lá chứ không phải tách gốc', () => {
    const f = onlyAsk(INSERT);
    const k = INSERT.indexOf(f);
    expect(f.event.kind === 'overflow' && f.event.keys.length).toBe(MAX_KEYS + 1);
    const next = INSERT[k + 1].event;
    expect(next.kind === 'split' && next.parent).not.toBeNull();
    expect(levels(INSERT.at(-1)!)).toBe(levels(INSERT[0]));
  });

  test('tách gốc: câu đoán ở frame tách gốc, và cây cao thêm đúng 1 tầng', () => {
    const f = onlyAsk(CASCADED);
    const k = CASCADED.indexOf(f);
    expect(f.event.kind === 'split' && f.event.parent).toBeNull();
    expect(levels(f)).toBe(levels(CASCADED[k - 1]) + 1);
    expect(isBTree(build([...BASE, ADDED, ...CASCADE]))).toBe(true);
  });

  test('khoá đã sort: đáp án là chiều cao thật sau khi chèn hết', () => {
    const f = onlyAsk(SORTED);
    expect(answerOf(f)).toBe(String(levels(SORTED.at(-1)!)));
    expect(HEIGHT_AFTER_SORTED).toBe(levels(SORTED.at(-1)!));
    expect(HEIGHT_AFTER_SORTED).toBeLessThan(SORTED_KEYS.length);
  });

  test('trang: đáp án khớp với minHeight của hàng cuối', () => {
    const f = onlyAsk(PAGES);
    expect(answerOf(f)).toBe(String(FANOUT_ROWS.at(-1)!.page));
    expect(FANOUT_ROWS.at(-1)!.page).toBe(minHeight(1e9, FANOUT));
  });

  test('tóm tắt: một hàng cho mỗi khoá chèn, chiều cao ở hàng cuối khớp với cây thật', () => {
    const rows = RECAP.at(-1)!.state.rows;
    expect(rows.map((r) => Number(r[0]))).toEqual(SORTED_KEYS);
    expect(rows.at(-1)![2]).toBe(String(heightOf(build(SORTED_KEYS))));
    expect(rows.filter((r) => r[1].includes('tách gốc')).length).toBe(
      heightOf(build(SORTED_KEYS)) - 1,
    );
  });

  test('quiz: con cần xuống và khoá đi lên khớp với code', () => {
    expect(NODE_KEYS[CHILD - 2] < LOOK_FOR && LOOK_FOR < NODE_KEYS[CHILD - 1]).toBe(true);
    const t = build([...LEAF, NEW_KEY]);
    expect(t.nodes[t.root].keys).toEqual([PROMOTED]);
  });
});
