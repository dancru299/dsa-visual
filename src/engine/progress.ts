'use client';

import { useMemo, useSyncExternalStore } from 'react';

// Tiến độ học lưu trong localStorage của trình duyệt. Mọi lần đọc, ghi đều bọc try/catch vì
// localStorage có thể bị chặn (cửa sổ ẩn danh, cài đặt trình duyệt); khi đó trang vẫn chạy,
// chỉ là không nhớ tiến độ.

const KEY = 'dsa-visual:progress:v1';

type Progress = Record<string, { answered?: unknown; quiz?: unknown }>;

// Điểm quiz cuối bài: lần làm gần nhất và lần cao nhất, trên tổng số câu lúc làm.
export type QuizScore = { last: number; best: number; total: number };

const listeners = new Set<() => void>();

function readRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

function parse(raw: string): Progress {
  try {
    const value: unknown = raw ? JSON.parse(raw) : {};
    return value && typeof value === 'object' ? (value as Progress) : {};
  } catch {
    return {};
  }
}

function write(all: Progress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Không lưu được thì bỏ qua.
  }
  listeners.forEach((l) => l());
}

function answeredOf(all: Progress, slug: string): string[] {
  const list = all[slug]?.answered;
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
}

function quizOf(all: Progress, slug: string): QuizScore | null {
  const q = all[slug]?.quiz as Partial<QuizScore> | undefined;
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;
  return q && ok(q.last) && ok(q.best) && ok(q.total) && q.total > 0
    ? { last: q.last, best: q.best, total: q.total }
    : null;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

// Trên server và lúc hydrate luôn là chuỗi rỗng, nên HTML render sẵn khớp với lần render đầu
// trên trình duyệt; tiến độ thật hiện ra ngay sau đó.
const useRaw = () => useSyncExternalStore(subscribe, readRaw, () => '');

// Khoá của một câu đoán: id của bước và chỉ số frame trong bước đó.
export const askKey = (stepId: string, frame: number) => `${stepId}:${frame}`;

// Các câu đoán đã trả lời của một bài.
export function useAnswered(slug: string): ReadonlySet<string> {
  const raw = useRaw();
  return useMemo(() => new Set(answeredOf(parse(raw), slug)), [raw, slug]);
}

export function recordAnswer(slug: string, key: string): void {
  const all = parse(readRaw());
  const answered = new Set(answeredOf(all, slug)).add(key);
  all[slug] = { ...all[slug], answered: [...answered] };
  write(all);
}

// Điểm quiz đã lưu của một bài, hoặc null nếu chưa làm.
export function useQuizScore(slug: string): QuizScore | null {
  const raw = useRaw();
  return useMemo(() => quizOf(parse(raw), slug), [raw, slug]);
}

// Lưu điểm một lần làm quiz. Nếu số câu đã đổi (bài được thêm câu) thì điểm cũ không so được,
// nên lần này thành điểm cao nhất mới.
export function recordQuiz(slug: string, score: number, total: number): void {
  const all = parse(readRaw());
  const prev = quizOf(all, slug);
  const best = prev && prev.total === total ? Math.max(prev.best, score) : score;
  all[slug] = { ...all[slug], quiz: { last: score, best, total } };
  write(all);
}
