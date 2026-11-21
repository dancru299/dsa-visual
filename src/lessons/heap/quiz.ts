import type { QuizQuestion } from '@/src/engine/types';
import { childrenOf } from './algorithm';

export const ARRAY = [2, 5, 3, 9, 6, 8];
export const ASKED = 1; // index của số được hỏi
export const KIDS = childrenOf(ASKED).map((c) => ARRAY[c]);

// Bước: 0 Cấu trúc, 1 push, 2 pop, 3 Top-K, 4 Trộn k dãy, 5 Tóm tắt.
export const QUIZ: QuizQuestion[] = [
  {
    step: 0,
    prompt: `Min-heap lưu trong list [${ARRAY.join(', ')}]. Hai con của số ${ARRAY[ASKED]} là số nào?`,
    choices: [KIDS.join(' và '), `${ARRAY[2]} và ${ARRAY[3]}`, `${ARRAY[4]} và ${ARRAY[5]}`],
    correct: 0,
    explain: `${ARRAY[ASKED]} ở index ${ASKED}, nên hai con ở index ${childrenOf(ASKED).join(' và ')}: là ${KIDS.join(' và ')}. Cả hai đều ≥ ${ARRAY[ASKED]}, đúng quy tắc min-heap.`,
  },
  {
    step: 3,
    prompt:
      'Giữ top 10 đơn hàng lớn nhất trên một dòng 1 tỷ đơn bằng min-heap. Heap chiếm bao nhiêu bộ nhớ?',
    choices: ['10 phần tử: O(k)', '1 tỷ phần tử: O(n)', 'Khoảng 30 phần tử: O(log n)'],
    correct: 0,
    explain:
      'Heap không bao giờ quá k phần tử: số mới chỉ vào khi đẩy gốc ra. Đó là lý do Top-K chạy được trên dữ liệu chảy liên tục mà không cần lưu lại mọi dòng.',
  },
  {
    step: 3,
    prompt: 'Vì sao tìm Top-K số lớn nhất lại dùng min-heap, không phải max-heap?',
    choices: [
      'Gốc là số nhỏ nhất trong top hiện tại, tức ngưỡng để loại số mới',
      'Vì min-heap luôn nhanh hơn max-heap',
      'Vì Python không làm được max-heap',
    ],
    correct: 0,
    explain:
      'Với mỗi số mới, câu hỏi duy nhất là "nó có lớn hơn số nhỏ nhất trong top không?". Min-heap đặt đúng số đó ở gốc, xem trong O(1). Muốn max-heap bằng heapq thì có thể lưu số âm.',
  },
  {
    step: 4,
    prompt:
      'Trộn 100 file log đã sort theo thời gian, mỗi file 1 triệu dòng. Heap giữ nhiều nhất bao nhiêu phần tử?',
    choices: ['100: một dòng đầu cho mỗi file', '100 triệu', '1 triệu'],
    correct: 0,
    explain:
      'Heap chỉ giữ dòng nhỏ nhất chưa lấy của mỗi file. Lấy một dòng ra thì mới đọc dòng kế tiếp của chính file đó, nên RAM chỉ cần cho 100 dòng.',
  },
];
