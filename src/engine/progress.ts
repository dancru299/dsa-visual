'use client';

import { useMemo, useSyncExternalStore } from 'react';

// Tiến độ học lưu trong localStorage của trình duyệt. Mọi lần đọc, ghi đều bọc try/catch vì
// localStorage có thể bị chặn (cửa sổ ẩn danh, cài đặt trình duyệt); khi đó trang vẫn chạy,
// chỉ là không nhớ tiến độ.

const KEY = 'dsa-visual:progress:v1';

type Progress = Record<string, { answered?: unknown }>;

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

function answeredOf(all: Progress, slug: string): string[] {
  const list = all[slug]?.answered;
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
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

// Khoá của một câu đoán: id của bước và chỉ số frame trong bước đó.
export const askKey = (stepId: string, frame: number) => `${stepId}:${frame}`;

// Các câu đoán đã trả lời của một bài. Trên server và lúc hydrate luôn là tập rỗng,
// nên HTML render sẵn khớp với lần render đầu trên trình duyệt.
export function useAnswered(slug: string): ReadonlySet<string> {
  const raw = useSyncExternalStore(subscribe, readRaw, () => '');
  return useMemo(() => new Set(answeredOf(parse(raw), slug)), [raw, slug]);
}

export function recordAnswer(slug: string, key: string): void {
  try {
    const all = parse(readRaw());
    const answered = new Set(answeredOf(all, slug)).add(key);
    all[slug] = { answered: [...answered] };
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Không lưu được thì bỏ qua.
  }
  listeners.forEach((l) => l());
}
