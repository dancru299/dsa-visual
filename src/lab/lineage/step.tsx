import { defineStep, type Frame, type LegendItem } from '@/src/engine/types';
import { graphScene } from '@/src/scenes/GraphScene';
import { traceBfs, type BfsEvent, type BfsState } from './algorithm';
import { LINEAGE, LINEAGE_LAYOUT } from './data';

export const SOURCE = 'raw_orders';

export const CODE_BFS = [
  'from collections import deque',
  '',
  'def affected(graph, source):',
  '    seen, queue = {source}, deque([source])',
  '    order = []',
  '    while queue:',
  '        table = queue.popleft()',
  '        order.append(table)',
  '        for child in graph.get(table, []):',
  '            if child not in seen:',
  '                seen.add(child)',
  '                queue.append(child)',
  '    return order',
];

// Lời dẫn cho trace BFS. Câu đoán đặt ở lần lấy ra đầu tiên mà queue đang có từ hai bảng trở lên:
// lúc đó mới phân biệt được queue (lấy đầu) với stack (lấy cuối).
export function narrateBfs(frames: Frame<BfsState, BfsEvent>[]): Frame<BfsState, BfsEvent>[] {
  let asked = false;
  return frames.map((f, k) => {
    const e = f.event;
    const s = f.state;
    const metrics = [
      {
        label: 'Đang xử lý',
        value: Object.keys(s.marks).find((n) => s.marks[n] === 'current') ?? '—',
      },
      { label: 'Queue', value: String(s.pending.length) },
      { label: 'Bảng bị ảnh hưởng', value: String(Object.keys(s.dist).length - 1) },
      { label: 'Đã lấy ra', value: String(s.order.length) },
    ];
    const base = { ...f, metrics };
    switch (e.kind) {
      case 'start':
        return {
          ...base,
          say: `${e.source} vừa đổi schema. Bảng nào phía sau bị ảnh hưởng?`,
          codeLines: [4, 5],
          holdMs: 1300,
        };
      case 'dequeue': {
        const before = frames[k - 1]?.state.pending ?? [];
        const ask =
          !asked && before.length >= 2
            ? {
                prompt: `Queue đang là ${before.join(', ')}. Bảng nào được lấy ra xử lý tiếp?`,
                choices: [before[0], before.at(-1)!],
                correct: 0,
                explain:
                  'Queue vào trước ra trước, nên BFS lấy bảng ở đầu queue. Nhờ vậy BFS xử lý hết các bảng cách nguồn 1 bước rồi mới tới các bảng cách 2 bước. Lấy bảng ở cuối, như stack, thì bạn đang làm DFS.',
              }
            : undefined;
        if (ask) asked = true;
        return {
          ...base,
          say: `lấy ${e.node} ra khỏi queue`,
          codeLines: [6, 7, 8],
          holdMs: 1000,
          ask,
        };
      }
      case 'discover':
        return {
          ...base,
          say: `${e.to} chưa thấy → thêm vào queue`,
          codeLines: [9, 10, 11, 12],
          holdMs: 1000,
        };
      case 'skip':
        return { ...base, say: `${e.to} đã thấy rồi → bỏ qua`, codeLines: [9, 10], holdMs: 800 };
      case 'finish':
        return { ...base, codeLines: [6], holdMs: 500 };
      case 'done':
        return {
          ...base,
          say: `Xong: ${s.order.length - 1} bảng phía sau cần chạy lại`,
          sayTone: 'good' as const,
          codeLines: [13],
          holdMs: 1500,
        };
    }
  });
}

const LineageScene = graphScene({
  layout: LINEAGE_LAYOUT,
  pendingTitle: 'QUEUE (LẤY RA Ở ĐẦU BÊN TRÁI)',
  orderTitle: 'THỨ TỰ LẤY RA',
  code: { file: 'lineage.py', lines: CODE_BFS },
});

export const FRAMES = narrateBfs(traceBfs(LINEAGE, SOURCE));

export const lineageStep = defineStep<BfsState, BfsEvent>({
  id: 'bfs-lineage',
  short: 'BFS',
  tag: 'THỬ NGHIỆM',
  tone: 'sky',
  title: 'Bảng nào bị ảnh hưởng khi raw_orders đổi?',
  Scene: LineageScene,
  build: () => FRAMES,
  Body: ({ frames }) => {
    const { order } = frames.at(-1)!.state;
    return (
      <p>
        BFS đi từ <code>{SOURCE}</code> theo chiều mũi tên, từng lớp một. Kết quả:{' '}
        {order.slice(1).join(', ')}. Các bảng phía khách hàng không bị chạm tới.
      </p>
    );
  },
});

export const LINEAGE_LEGEND: LegendItem[] = [
  { swatch: 'ash', label: 'chưa tới' },
  { swatch: 'peach', label: 'trong queue' },
  { swatch: 'sun', label: 'đang xử lý' },
  { swatch: 'mint', label: 'đã xử lý' },
];
