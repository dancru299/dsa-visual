'use client';

import { useCallback, useSyncExternalStore } from 'react';

// Bước đang mở lưu trên URL (#buoc-3), để gửi link thẳng tới một bước và tải lại không bị mất.
// Trên server và lúc hydrate luôn là bước đầu, nên HTML render sẵn khớp với lần render đầu.

const listeners = new Set<() => void>();
const PATTERN = /^#buoc-(\d+)$/;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('hashchange', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('hashchange', onChange);
  };
}

export function useHashStep(count: number): [number, (index: number) => void] {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  const match = PATTERN.exec(hash);
  const index = match ? Math.max(0, Math.min(count - 1, Number(match[1]) - 1)) : 0;

  const setIndex = useCallback((i: number) => {
    window.history.replaceState(null, '', `#buoc-${i + 1}`);
    listeners.forEach((l) => l());
  }, []);

  return [index, setIndex];
}
