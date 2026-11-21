// Logic của player, viết thành reducer thuần để test được mà không cần React hay trình duyệt.
// Player chủ yếu giữ một con số: đang ở frame nào. Play là tăng số đó theo thời gian;
// tua, lùi, nhảy đều chỉ là gán lại số đó.

export type PlayerState = {
  frame: number;
  count: number; // số frame của bước đang mở
  playing: boolean;
  animate: boolean; // false ngay sau khi tua hoặc lùi, để Scene vẽ thẳng trạng thái mới
  asks: ReadonlySet<number>; // các frame có câu đoán
  answered: ReadonlySet<number>; // các câu đoán đã trả lời trong lần mở bước này
  pendingAsk: number | null; // frame đang chờ người học trả lời rồi mới hiện
};

export type PlayerAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  | { type: 'tick' } // hết holdMs của frame hiện tại khi đang Play
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'seek'; frame: number }
  | { type: 'replay' }
  | { type: 'answer' };

export function initPlayer(count: number, asks: Iterable<number>, autoplay = true): PlayerState {
  return {
    frame: 0,
    count,
    playing: autoplay && count > 1,
    animate: false,
    asks: new Set(asks),
    answered: new Set(),
    pendingAsk: null,
  };
}

// Đi tới frame kế tiếp. Nếu frame đó có câu đoán chưa trả lời thì dừng lại và hỏi.
function advance(s: PlayerState, keepPlaying: boolean): PlayerState {
  const target = s.frame + 1;
  if (target >= s.count) return { ...s, playing: false };
  if (s.asks.has(target) && !s.answered.has(target)) {
    return { ...s, playing: false, pendingAsk: target };
  }
  return { ...s, frame: target, animate: true, playing: keepPlaying && target < s.count - 1 };
}

const clamp = (s: PlayerState, i: number) => Math.max(0, Math.min(s.count - 1, i));

export function playerReducer(s: PlayerState, a: PlayerAction): PlayerState {
  switch (a.type) {
    case 'tick':
      return s.playing ? advance(s, true) : s;
    case 'next':
      return s.pendingAsk !== null ? s : advance(s, false);
    case 'prev':
      return {
        ...s,
        frame: clamp(s, s.frame - 1),
        animate: false,
        playing: false,
        pendingAsk: null,
      };
    case 'seek':
      return { ...s, frame: clamp(s, a.frame), animate: false, playing: false, pendingAsk: null };
    case 'replay':
      return { ...s, frame: 0, animate: false, playing: s.count > 1, pendingAsk: null };
    case 'play':
      if (s.pendingAsk !== null) return s;
      if (s.frame >= s.count - 1) return playerReducer(s, { type: 'replay' });
      return { ...s, playing: true };
    case 'pause':
      return { ...s, playing: false };
    case 'toggle':
      return playerReducer(s, { type: s.playing ? 'pause' : 'play' });
    case 'answer': {
      if (s.pendingAsk === null) return s;
      const frame = s.pendingAsk;
      const answered = new Set(s.answered).add(frame);
      return {
        ...s,
        answered,
        frame,
        animate: true,
        pendingAsk: null,
        playing: frame < s.count - 1,
      };
    }
  }
}
