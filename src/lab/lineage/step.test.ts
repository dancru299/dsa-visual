import { describe, expect, test } from 'vitest';
import { FRAMES } from './step';

describe('bản thử scene đồ thị', () => {
  test('có đúng một câu đoán, không nằm ở frame đầu, đáp án là bảng vừa lấy ra', () => {
    const asks = FRAMES.map((f, i) => ({ f, i })).filter(({ f }) => f.ask);
    expect(asks).toHaveLength(1);
    const { f, i } = asks[0];
    expect(i).toBeGreaterThan(0);
    expect(f.event.kind).toBe('dequeue');
    if (f.event.kind === 'dequeue') expect(f.ask!.choices[f.ask!.correct]).toBe(f.event.node);
  });

  test('các lựa chọn khác nhau, nên câu hỏi thật sự phân biệt queue với stack', () => {
    const ask = FRAMES.find((f) => f.ask)!.ask!;
    expect(new Set(ask.choices).size).toBe(ask.choices.length);
  });
});
