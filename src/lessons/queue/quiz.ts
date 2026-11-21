import type { QuizQuestion } from '@/src/engine/types';
import { tailOf } from './algorithm';

export const RING = { capacity: 8, head: 6, size: 3 };
export const RING_TAIL = tailOf(RING);

// Bước: 0 FIFO, 1 dequeue, 2 Bẫy pop(0), 3 Ring buffer, 4 Khi đầy, 5 Tóm tắt.
export const QUIZ: QuizQuestion[] = [
  {
    step: 2,
    prompt:
      'Dùng list.pop(0) để lấy phần tử đầu của một list 1 triệu phần tử. Mỗi lần tốn bao nhiêu?',
    choices: [
      'O(n): dời mọi phần tử còn lại lên một ô',
      'O(1), giống pop() ở cuối list',
      'O(log n)',
    ],
    correct: 0,
    explain:
      'List của Python là một mảng liền nhau, lấy phần tử đầu ra thì mọi phần tử phía sau phải dời lên. Làm queue thì dùng collections.deque: popleft() là O(1).',
  },
  {
    step: 3,
    prompt: `Ring buffer ${RING.capacity} ô (đánh số 0 tới ${RING.capacity - 1}), phần tử đầu ở ô ${RING.head}, đang có ${RING.size} phần tử. Phần tử mới được ghi vào ô nào?`,
    choices: [String(RING_TAIL), String(RING.head + RING.size), '0'],
    correct: 0,
    explain: `Ô ghi tiếp = (đầu + số phần tử) % sức chứa = (${RING.head} + ${RING.size}) % ${RING.capacity} = ${RING_TAIL}. Hết ô cuối thì quay về ô 0: đó là chữ "ring".`,
  },
  {
    step: 4,
    prompt:
      'Producer đẩy 1.000 bản ghi mỗi giây, consumer chỉ xử lý được 800. Buffer ở giữa có giới hạn. Sau một lúc thì sao?',
    choices: [
      'Buffer đầy: producer phải chờ (backpressure), hoặc phải bỏ bớt bản ghi',
      'Consumer tự chạy nhanh hơn',
      'Không sao, buffer tự giãn ra',
    ],
    correct: 0,
    explain:
      'Mỗi giây dư 200 bản ghi, nên buffer nào rồi cũng đầy. Lúc đó chỉ còn hai cách: bắt producer chờ, hoặc bỏ bớt dữ liệu. Muốn hết hẳn thì phải tăng tốc phía consumer, ví dụ chạy thêm consumer song song.',
  },
  {
    step: 4,
    prompt: 'queue.Queue(maxsize=100) đã đầy. Gọi put(item) với tham số mặc định thì sao?',
    choices: ['Chờ tới khi có chỗ trống', 'Ghi đè phần tử cũ nhất', 'Bỏ qua item mà không báo gì'],
    correct: 0,
    explain:
      'put() mặc định block cho tới khi consumer lấy bớt: đó chính là backpressure. Không muốn chờ thì dùng put_nowait(), nó báo queue.Full ngay.',
  },
];
