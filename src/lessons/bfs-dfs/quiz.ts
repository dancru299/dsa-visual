import type { QuizQuestion } from '@/src/engine/types';
import { bfsOrder, dfsOrder, type Graph } from './algorithm';

export const SMALL: Graph = { A: ['B', 'C'], B: ['D'], C: ['E'] };
export const BFS_SMALL = bfsOrder(SMALL, 'A');
export const DFS_SMALL = dfsOrder(SMALL, 'A');
// Một thứ tự sai: đi sâu nhưng lấy con theo thứ tự ngược.
export const WRONG_SMALL = ['A', 'C', 'E', 'B', 'D'];

// Bước: 0 Đồ thị, 1 BFS, 2 DFS, 3 Vì sao cần seen, 4 dbt +n, 5 Tóm tắt.
export const QUIZ: QuizQuestion[] = [
  {
    step: 1,
    prompt: "BFS từ 'A', các bảng con lấy theo thứ tự trong list. Thứ tự lấy ra khỏi queue là gì?",
    code: [
      `graph = {${Object.entries(SMALL)
        .map(([k, vs]) => `'${k}': [${vs.map((v) => `'${v}'`).join(', ')}]`)
        .join(', ')}}`,
    ],
    choices: [BFS_SMALL.join(', '), DFS_SMALL.join(', '), WRONG_SMALL.join(', ')],
    correct: 0,
    explain: `BFS xong cả lớp 1 (B, C) rồi mới tới lớp 2 (D, E). ${DFS_SMALL.join(', ')} là thứ tự của DFS: đi hết nhánh B rồi mới sang C.`,
  },
  {
    step: 5,
    prompt: 'Cần biết mỗi dashboard cách raw_events ít nhất bao nhiêu bước. Dùng cách duyệt nào?',
    choices: ['BFS', 'DFS', 'Cái nào cũng được, kết quả như nhau'],
    correct: 0,
    explain:
      'BFS đi theo lớp, nên lần đầu gặp một bảng là qua đường ít bước nhất. DFS có thể tới bảng đó qua một đường dài trước, rồi đánh dấu đã thấy.',
  },
  {
    step: 3,
    prompt: 'Lineage bị lỗi có vòng a → b → a. Chạy BFS mà bỏ tập seen thì sao?',
    choices: [
      'Chạy mãi: a và b thay nhau vào queue',
      'Vẫn dừng, chỉ chậm hơn',
      'Python báo lỗi ngay',
    ],
    correct: 0,
    explain:
      'Lấy a ra thì thêm b, lấy b ra lại thêm a, cứ thế queue không bao giờ rỗng. Tập seen chặn chuyện này: mỗi bảng chỉ vào queue một lần.',
  },
  {
    step: 1,
    prompt: 'Lineage có 2.000 bảng và 5.000 cạnh. BFS từ một bảng tốn cỡ bao nhiêu bước?',
    choices: ['Khoảng 7.000: O(V + E)', 'Khoảng 10 triệu: O(V × E)', 'Khoảng 4 triệu: O(V²)'],
    correct: 0,
    explain:
      'Mỗi bảng vào queue nhiều nhất một lần (V), mỗi cạnh được xét nhiều nhất một lần (E). Cộng lại khoảng 2.000 + 5.000 bước.',
  },
];
