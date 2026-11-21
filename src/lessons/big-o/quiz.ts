import type { QuizQuestion } from '@/src/engine/types';
import { worstCaseBinary } from '../binary-search/algorithm';

const SORTED_STEPS = worstCaseBinary(10_000_000);

// Bước: 0 O(1), 1 O(n), 2 O(log n), 3 O(n²), 4 n = 1 tỷ.
export const QUIZ: QuizQuestion[] = [
  {
    step: 1,
    prompt:
      'Bảng orders có 10 triệu dòng và không có index. WHERE order_id = 42 phải đọc nhiều nhất bao nhiêu dòng?',
    choices: ['10 triệu dòng', `Khoảng ${SORTED_STEPS} dòng`, '1 dòng'],
    correct: 0,
    explain:
      'Không có index thì không biết dòng cần tìm nằm ở đâu, nên phải đọc lần lượt; tệ nhất là hết bảng. Đó là full scan, O(n).',
  },
  {
    step: 2,
    prompt:
      'Vẫn 10 triệu dòng, nhưng order_id đã sort và tra bằng binary search. Cần nhiều nhất bao nhiêu lần so?',
    choices: [String(SORTED_STEPS), '10 triệu', '5 triệu'],
    correct: 0,
    explain: `Mỗi lần so loại một nửa: 10 triệu chia đôi ${SORTED_STEPS} lần thì còn 1 dòng. Index của database cũng thu hẹp phạm vi theo cách tương tự, nên tra một dòng rất rẻ.`,
  },
  {
    step: 3,
    prompt:
      'JOIN orders (1.000 dòng) với customers (1.000 dòng) bằng hai vòng for lồng nhau. Cần bao nhiêu lần so khoá?',
    choices: ['1 triệu lần', '2.000 lần', '1.000 lần'],
    correct: 0,
    explain:
      'Mỗi dòng bên trái so với mọi dòng bên phải: 1.000 × 1.000. Hash join đưa một bảng vào dict trước, rồi mỗi dòng bên kia chỉ tra một lần, tổng cộng khoảng 2.000 bước.',
  },
  {
    step: 3,
    prompt: 'rows có n dòng, phần lớn id khác nhau. Đoạn code dưới đây tốn cỡ bao nhiêu bước?',
    code: [
      'seen = []',
      'for row in rows:',
      "    if row['id'] not in seen:",
      "        seen.append(row['id'])",
    ],
    choices: [
      'O(n²), vì "in" trên list duyệt từng phần tử',
      'O(n), vì mỗi dòng chỉ xem một lần',
      'O(log n)',
    ],
    correct: 0,
    explain:
      '"x in list" đi qua từng phần tử nên tốn O(n), lặp n lần thành O(n²). Đổi seen thành set thì "in" trung bình O(1), cả đoạn còn O(n).',
  },
];
