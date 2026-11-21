import type { Ask } from '@/src/engine/types';

// Xáo thứ tự đáp án nhưng cố định theo nội dung câu hỏi, để lần render nào cũng giống nhau
// (server và trình duyệt khớp nhau) và đáp án đúng không luôn nằm ở cùng một chỗ.
export function choiceOrder(ask: Pick<Ask, 'prompt' | 'choices'>): number[] {
  const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return ask.choices
    .map((c, i) => ({ i, h: hash(ask.prompt + '|' + c) }))
    .sort((a, b) => a.h - b.h)
    .map((x) => x.i);
}
