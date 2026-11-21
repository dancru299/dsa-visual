'use client';

import { useEffect, useReducer, useSyncExternalStore } from 'react';
import { initPlayer, playerReducer } from './player';
import type { Frame } from './types';

export const DEFAULT_HOLD_MS = 900;

// Mỗi lần mở một bước, component gọi hook này được mount lại (key theo id của bước),
// nên player luôn bắt đầu từ frame 0.
export function usePlayer(frames: Frame<unknown>[], speed: number) {
  const [state, dispatch] = useReducer(playerReducer, frames, (fs) =>
    initPlayer(
      fs.length,
      fs.flatMap((f, i) => (f.ask ? [i] : [])),
    ),
  );

  useEffect(() => {
    if (!state.playing) return;
    const hold = (frames[state.frame]?.holdMs ?? DEFAULT_HOLD_MS) / speed;
    const timer = setTimeout(() => dispatch({ type: 'tick' }), hold);
    return () => clearTimeout(timer);
  }, [state.playing, state.frame, speed, frames]);

  return [state, dispatch] as const;
}

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

// Giảm chuyển động chỉ tắt hiệu ứng. Player vẫn dừng holdMs ở từng frame như bình thường.
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
