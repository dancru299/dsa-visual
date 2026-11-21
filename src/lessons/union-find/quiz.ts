import type { QuizQuestion } from '@/src/engine/types';
import { rootOf } from './algorithm';

export const QUIZ_PARENT = [0, 0, 1, 1, 3];
export const QUIZ_X = 4;
export const QUIZ_ROOT = rootOf(QUIZ_PARENT, QUIZ_X);
export const BIG_N = 1000;
export const BIG_HEIGHT = Math.floor(Math.log2(BIG_N)) + 1;

// Bước: 0 find, 1 union, 2 Bẫy chuỗi, 3 Theo kích thước, 4 Nén đường, 5 Gộp bản ghi.
export const QUIZ: QuizQuestion[] = [
  {
    step: 0,
    prompt: `parent = [${QUIZ_PARENT.join(', ')}]. Gốc của ${QUIZ_X} là phần tử nào?`,
    choices: [
      String(QUIZ_ROOT),
      String(QUIZ_PARENT[QUIZ_X]),
      String(QUIZ_PARENT[QUIZ_PARENT[QUIZ_X]]),
    ],
    correct: 0,
    explain: `Đi theo parent: ${QUIZ_X} → ${QUIZ_PARENT[QUIZ_X]} → ${QUIZ_PARENT[QUIZ_PARENT[QUIZ_X]]} → ${QUIZ_ROOT}. Gốc là phần tử có parent bằng chính nó: parent[${QUIZ_ROOT}] = ${QUIZ_ROOT}.`,
  },
  {
    step: 1,
    prompt:
      'Có 10 phần tử, mỗi cái một nhóm. Gọi union 4 lần, lần nào cũng gộp hai nhóm khác nhau. Còn bao nhiêu nhóm?',
    choices: ['6', '4', '10'],
    correct: 0,
    explain:
      'Mỗi lần gộp hai nhóm khác nhau thì số nhóm giảm đúng 1: 10 − 4 = 6. Lần union nào gặp hai phần tử đã cùng nhóm thì không đổi gì.',
  },
  {
    step: 3,
    prompt: `Luôn gắn cây nhỏ vào dưới cây lớn. Một nhóm ${BIG_N.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} phần tử cao nhiều nhất bao nhiêu tầng?`,
    choices: [String(BIG_HEIGHT), '1.000', '500'],
    correct: 0,
    explain: `Một phần tử chỉ xuống sâu thêm khi cây của nó bị gắn vào cây lớn hơn, tức nhóm của nó ít nhất gấp đôi. Gấp đôi từ 1 tới ${BIG_N} được nhiều nhất khoảng log₂ ${BIG_N} lần, nên cây cao không quá ${BIG_HEIGHT} tầng.`,
  },
  {
    step: 4,
    prompt:
      'Dùng cả hai mẹo (gắn cây nhỏ vào cây lớn, nén đường). Trên thực tế một lần find tốn khoảng bao nhiêu bước?',
    choices: ['Gần như hằng số, chỉ vài bước', 'Khoảng log₂ n bước', 'Khoảng n bước'],
    correct: 0,
    explain:
      'Mỗi lần find kéo cả đường đi lên sát gốc, nên các lần sau rất ngắn. Tính trung bình, mỗi thao tác tốn O(α(n)), với α là hàm tăng cực chậm: không quá 4 với mọi kích thước dữ liệu thực tế.',
  },
  {
    step: 5,
    prompt:
      'Bản ghi X và Z không có email hay số điện thoại nào chung, nhưng cả hai đều chung một giá trị với bản ghi Y. Union-Find xếp X và Z thế nào?',
    choices: ['Cùng một nhóm: gộp có tính bắc cầu', 'Hai nhóm riêng', 'Tuỳ thứ tự xử lý các cặp'],
    correct: 0,
    explain:
      'union(X, Y) rồi union(Y, Z) đưa cả ba về cùng một gốc, theo thứ tự nào cũng vậy. Đó là điều cần khi gộp khách hàng: một chuỗi bằng chứng nối nhau cũng đủ để xem là cùng một người.',
  },
];
