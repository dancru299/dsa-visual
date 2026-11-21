import type { QuizQuestion } from '@/src/engine/types';
import type { Graph } from './algorithm';

export const SMALL: Graph = {
  raw_orders: ['stg_orders'],
  stg_orders: ['fct_orders'],
  dim_customers: ['fct_orders'],
};
// Lựa chọn đầu tiên là thứ tự hợp lệ duy nhất trong ba lựa chọn; test kiểm tra điều đó.
export const ORDERS = [
  ['dim_customers', 'raw_orders', 'stg_orders', 'fct_orders'],
  ['raw_orders', 'fct_orders', 'stg_orders', 'dim_customers'],
  ['stg_orders', 'raw_orders', 'dim_customers', 'fct_orders'],
];

// Bước: 0 Bậc vào, 1 Kahn, 2 Theo đợt, 3 Có vòng, 4 Bằng DFS, 5 Tóm tắt.
export const QUIZ: QuizQuestion[] = [
  {
    step: 0,
    prompt: 'Với các phụ thuộc dưới đây, thứ tự chạy nào hợp lệ?',
    code: Object.entries(SMALL).flatMap(([from, tos]) => tos.map((to) => `${from} → ${to}`)),
    choices: ORDERS.map((o) => o.join(', ')),
    correct: 0,
    explain:
      'Mọi mũi tên phải đi từ bảng chạy trước sang bảng chạy sau. dim_customers không phụ thuộc ai nên chạy đầu cũng được. Hai thứ tự kia đặt fct_orders trước stg_orders, hoặc stg_orders trước raw_orders.',
  },
  {
    step: 2,
    prompt:
      'DAG chia được thành 4 đợt, mỗi model chạy 10 phút, dbt chạy với --threads 50. Cả pipeline nhanh nhất mất bao lâu?',
    choices: [
      '40 phút: mỗi đợt phải chờ đợt trước xong',
      '10 phút: đủ thread thì chạy hết cùng lúc',
      '50 phút',
    ],
    correct: 0,
    explain:
      'Thread chỉ giúp các model trong cùng một đợt chạy song song. Đợt sau đọc dữ liệu của đợt trước nên phải chờ: 4 đợt × 10 phút. Muốn nhanh hơn thì phải rút ngắn critical path.',
  },
  {
    step: 3,
    prompt: 'Kahn chạy xong, order có 7 bảng trong khi DAG khai báo 9 bảng. Kết luận gì?',
    choices: [
      'Có vòng: vài bảng không bao giờ hết phải chờ',
      'Hai bảng không có cạnh nào nên bị bỏ qua',
      'Queue đầy nên thuật toán dừng sớm',
    ],
    correct: 0,
    explain:
      'Bảng không có cạnh nào có bậc vào 0 nên chạy ngay từ đầu, không bị bỏ qua. Còn sót bảng chỉ có thể là do vòng: các bảng trên vòng và phía sau nó không bao giờ về bậc vào 0.',
  },
  {
    step: 5,
    prompt: 'graphlib.TopologicalSorter(graph) của Python muốn dict graph theo chiều nào?',
    choices: [
      'Mỗi bảng → các bảng nó phụ thuộc',
      'Mỗi bảng → các bảng dùng nó',
      'Một list các cặp (từ, tới)',
    ],
    correct: 0,
    explain:
      'graphlib nhận mỗi node kèm các node phải chạy trước nó (predecessors), ngược chiều với danh sách kề ở bài BFS và DFS. Truyền nhầm chiều thì thứ tự ra bị đảo ngược.',
  },
];
