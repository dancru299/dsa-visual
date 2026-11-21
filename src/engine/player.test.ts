import { describe, expect, test } from 'vitest';
import { initPlayer, playerReducer, type PlayerAction, type PlayerState } from './player';

const run = (s: PlayerState, ...actions: PlayerAction[]) => actions.reduce(playerReducer, s);

describe('playerReducer', () => {
  test('Play đi hết các frame rồi tự dừng ở frame cuối', () => {
    const s = run(initPlayer(3, []), { type: 'tick' }, { type: 'tick' }, { type: 'tick' });
    expect(s.frame).toBe(2);
    expect(s.playing).toBe(false);
  });

  test('dừng trước frame có câu đoán, trả lời xong mới hiện frame đó và chạy tiếp', () => {
    let s = run(initPlayer(4, [2]), { type: 'tick' }, { type: 'tick' });
    expect(s.frame).toBe(1);
    expect(s.pendingAsk).toBe(2);
    expect(s.playing).toBe(false);

    // Khi đang chờ trả lời, Play và Next đều không vượt qua được câu hỏi.
    expect(run(s, { type: 'play' }, { type: 'tick' }).frame).toBe(1);
    expect(run(s, { type: 'next' }).frame).toBe(1);

    s = run(s, { type: 'answer' });
    expect(s.frame).toBe(2);
    expect(s.pendingAsk).toBeNull();
    expect(s.playing).toBe(true);
    expect(s.animate).toBe(true);
  });

  test('câu đã trả lời không chặn lại khi lùi rồi đi tiếp', () => {
    const s = run(initPlayer(4, [2]), { type: 'tick' }, { type: 'tick' }, { type: 'answer' });
    const again = run(s, { type: 'prev' }, { type: 'next' });
    expect(again.frame).toBe(2);
    expect(again.pendingAsk).toBeNull();
  });

  test('tua tới frame bất kỳ thì dừng Play, tắt chuyển động và bỏ câu đang chờ', () => {
    const waiting = run(initPlayer(5, [2]), { type: 'tick' }, { type: 'tick' });
    const s = run(waiting, { type: 'seek', frame: 4 });
    expect(s).toMatchObject({ frame: 4, playing: false, animate: false, pendingAsk: null });
  });

  test('seek bị kẹp trong khoảng hợp lệ', () => {
    expect(run(initPlayer(3, []), { type: 'seek', frame: 99 }).frame).toBe(2);
    expect(run(initPlayer(3, []), { type: 'seek', frame: -5 }).frame).toBe(0);
  });

  test('Play ở frame cuối thì chạy lại từ đầu', () => {
    const s = run(initPlayer(3, [], false), { type: 'seek', frame: 2 }, { type: 'play' });
    expect(s).toMatchObject({ frame: 0, playing: true });
  });

  test('bước chỉ có một frame thì không tự chạy', () => {
    expect(initPlayer(1, []).playing).toBe(false);
  });
});
