import type { QuizQuestion } from '@/src/engine/types';
import { worstCaseBinary } from './algorithm';

export const DATES = ['2024-01-03', '2024-02-10', '2024-03-15', '2024-04-01'];
export const TARGET_DATE = '2024-03-01';
// bisect_left: số phần tử nhỏ hơn giá trị cần tìm, tức chỗ chèn vào mà list vẫn sort.
export const BISECT_INDEX = DATES.filter((d) => d < TARGET_DATE).length;

// Bước: 0 Bài toán, 1 Đi từng ô, 2 Nhìn giữa, 3 Lặp lại, 4 Tìm thấy, 5 Không có,
// 6 Vì sao log n, 7 Tóm tắt.
export const QUIZ: QuizQuestion[] = [
  {
    step: 6,
    prompt:
      'Tìm một mã khách hàng trong 1 tỷ mã đã sort. Binary search cần nhiều nhất bao nhiêu lần so?',
    choices: [String(worstCaseBinary(1e9)), '1.000', '500 triệu'],
    correct: 0,
    explain: `Mỗi lần so loại một nửa, và 2³⁰ ≈ 1,07 tỷ, nên ${worstCaseBinary(1e9)} lần là đủ.`,
  },
  {
    step: 6,
    prompt:
      'Dữ liệu tăng gấp đôi, từ 1 triệu lên 2 triệu phần tử. Số lần so nhiều nhất của binary search thay đổi thế nào?',
    choices: [`Thêm đúng ${worstCaseBinary(2e6) - worstCaseBinary(1e6)} lần`, 'Gấp đôi', 'Gấp bốn'],
    correct: 0,
    explain:
      'Lần so đầu tiên chia 2 triệu còn 1 triệu; phần còn lại y như trước. log₂(2n) = log₂ n + 1.',
  },
  {
    step: 0,
    prompt: 'Chạy binary search trên một list chưa sort thì sao?',
    choices: [
      'Có thể báo không tìm thấy dù giá trị có trong list',
      'Vẫn đúng, chỉ chậm hơn',
      'Python báo lỗi',
    ],
    correct: 0,
    explain:
      'Binary search bỏ cả một nửa vì tin rằng mọi số bên trái đều nhỏ hơn. List chưa sort thì điều đó sai, và nó có thể bỏ đúng nửa chứa giá trị. Không có lỗi nào được báo, nên rất khó phát hiện.',
  },
  {
    step: 7,
    prompt: 'bisect của Python làm binary search. Sau đoạn code dưới đây, i bằng bao nhiêu?',
    code: [
      'import bisect',
      `dates = [${DATES.map((d) => `'${d}'`).join(', ')}]`,
      `i = bisect.bisect_left(dates, '${TARGET_DATE}')`,
    ],
    choices: [String(BISECT_INDEX), String(BISECT_INDEX + 1), '-1'],
    correct: 0,
    explain: `bisect_left trả về chỗ chèn vào mà list vẫn sort: '${TARGET_DATE}' đứng sau ${BISECT_INDEX} ngày nhỏ hơn nó, nên i = ${BISECT_INDEX}. Không có giá trị đó thì nó vẫn trả về một vị trí, không trả về -1. Chuỗi ngày dạng YYYY-MM-DD so sánh đúng theo thứ tự thời gian.`,
  },
];
