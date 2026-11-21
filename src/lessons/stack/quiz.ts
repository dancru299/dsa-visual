import type { QuizQuestion } from '@/src/engine/types';
import { isValid, Stack } from './algorithm';

export const OPS = ['push A', 'push B', 'pop', 'push C', 'pop', 'pop'];
export const POPPED = (() => {
  const s = new Stack<string>();
  const out: string[] = [];
  for (const op of OPS) {
    if (op === 'pop') out.push(s.pop()!);
    else s.push(op.split(' ')[1]);
  }
  return out;
})();

export const CROSSED = '([)]';
export const CROSSED_VALID = isValid(CROSSED);

// Bước: 0 LIFO, 1 push, 2 pop, 3 Ngoặc đúng, 4 Ngoặc sai, 5 Call stack.
export const QUIZ: QuizQuestion[] = [
  {
    step: 2,
    prompt: `Stack rỗng, làm lần lượt: ${OPS.join(', ')}. Các phần tử được lấy ra theo thứ tự nào?`,
    choices: [POPPED.join(', '), 'A, B, C', 'B, A, C'],
    correct: 0,
    explain: `pop luôn lấy phần tử vào sau cùng: lần đầu lấy B, rồi C vừa vào, cuối cùng mới tới A nằm dưới đáy. Kết quả: ${POPPED.join(', ')}.`,
  },
  {
    step: 4,
    prompt: `Kiểm tra chuỗi ${CROSSED} bằng stack. Kết quả là gì?`,
    choices: [
      CROSSED_VALID ? 'Hợp lệ' : 'Không hợp lệ: gặp ) khi đỉnh stack đang là [',
      'Hợp lệ: mỗi loại ngoặc có đủ mở và đóng',
      'Không hợp lệ vì không được trộn hai loại ngoặc',
    ],
    correct: 0,
    explain:
      'Đếm thì đủ cặp, nhưng thứ tự sai. Sau ( và [, đỉnh stack là [; dấu ) phải khớp với đỉnh nên báo lỗi ngay. Trộn nhiều loại ngoặc vẫn hợp lệ nếu đóng đúng thứ tự, ví dụ ([]).',
  },
  {
    step: 5,
    prompt: 'Một hàm đệ quy quên điểm dừng. Chạy trong Python thì chuyện gì xảy ra?',
    choices: [
      'Báo RecursionError khi call stack sâu khoảng 1000 lời gọi',
      'Chạy mãi cho tới khi bạn tắt chương trình',
      'Trả về None',
    ],
    correct: 0,
    explain:
      'Mỗi lời gọi đẩy một khung lên call stack. Python mặc định giới hạn độ sâu khoảng 1000 để không làm sập cả tiến trình, vượt qua thì báo RecursionError.',
  },
  {
    step: 0,
    prompt: 'Nút Undo (Ctrl+Z) trong một trình soạn thảo SQL nên lưu lịch sử thao tác bằng gì?',
    choices: [
      'Stack: thao tác làm sau cùng được huỷ trước',
      'Queue: thao tác làm đầu tiên được huỷ trước',
      'Hash table: tra thao tác theo tên',
    ],
    correct: 0,
    explain:
      'Undo luôn huỷ việc vừa làm gần nhất, rồi tới việc trước đó: vào sau, ra trước. Mỗi thao tác là một lần push, mỗi lần Undo là một lần pop.',
  },
];
