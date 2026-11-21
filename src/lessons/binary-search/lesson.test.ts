import { describe, expect, test } from 'vitest';
import type { Frame } from '@/src/engine/types';
import type { BSEvent, BSState } from './algorithm';
import { ARR, binarySearchLesson, T73, TARGET } from './lesson';

const { steps } = binarySearchLesson;
const built = steps.map((s) => ({ step: s, frames: s.build() as Frame<unknown, unknown>[] }));

describe('bài Binary Search', () => {
  test('mỗi bước có ít nhất một frame', () => {
    for (const { frames } of built) expect(frames.length).toBeGreaterThan(0);
  });

  test('id của các bước không trùng nhau', () => {
    const ids = steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Player chỉ hỏi trước khi đi tới một frame, nên frame đầu của bước không được có câu đoán.
  test('frame đầu của mỗi bước không có câu đoán', () => {
    for (const { step, frames } of built) expect(frames[0].ask, step.id).toBeUndefined();
  });

  test('cả bài có ít nhất 3 câu đoán', () => {
    const asks = built.flatMap(({ frames }) => frames.filter((f) => f.ask));
    expect(asks.length).toBeGreaterThanOrEqual(3);
  });

  test('đáp án của mỗi câu đoán khớp với frame chứa nó', () => {
    for (const { frames } of built) {
      for (const f of frames as Frame<BSState, BSEvent>[]) {
        if (!f.ask) continue;
        const answer = f.ask.choices[f.ask.correct];
        expect(new Set(f.ask.choices).size).toBe(f.ask.choices.length);
        switch (f.event.kind) {
          case 'compare':
            expect(answer).toBe(String(f.event.mid));
            expect(f.state.focus).toBe(f.event.mid);
            break;
          case 'go-right':
            expect(answer).toMatch(/^Nửa trái/);
            expect(f.state.lo).toBe(f.event.mid + 1);
            break;
          case 'not-found':
            expect(answer).toMatch(/trả về -1/);
            expect(f.state.result).toBe(-1);
            break;
          default:
            throw new Error(`Chưa có cách kiểm tra câu đoán cho event ${f.event.kind}`);
        }
      }
    }
  });

  test('các bước 3, 4, 5 nối liền nhau và đi hết trace tìm 73', () => {
    const ids = ['nhin-giua', 'lap-lai', 'tim-thay'];
    const parts = built.filter(({ step }) => ids.includes(step.id)).map(({ frames }) => frames);
    // Bước sau bắt đầu bằng frame cuối của bước trước.
    expect(parts[1][0].event).toEqual(parts[0].at(-1)!.event);
    expect(parts[2][0].event).toEqual(parts[1].at(-1)!.event);
    expect((parts[2].at(-1)!.state as BSState).result).toBe(ARR.indexOf(TARGET));
    expect(parts.flat().length - 2).toBe(T73.length);
  });

  test('tiêu đề bước 5 lấy số so sánh từ trace', () => {
    const step = steps.find((s) => s.id === 'tim-thay')!;
    expect(step.title).toBe('4 lần so sánh thay vì 13');
  });

  test('mục tiêu học trỏ tới bước có thật', () => {
    for (const o of binarySearchLesson.objectives) {
      expect(o.step).toBeGreaterThanOrEqual(0);
      expect(o.step).toBeLessThan(steps.length);
    }
  });
});
