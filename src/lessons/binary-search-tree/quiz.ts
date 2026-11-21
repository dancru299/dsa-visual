import type { QuizQuestion } from '@/src/engine/types';
import { balancedHeight, build } from './algorithm';

export const QUIZ_KEYS = [8, 3, 10, 1, 6];
export const QUIZ_NEW = QUIZ_KEYS.at(-1)!;
const tree = build(QUIZ_KEYS);
export const QUIZ_PARENT = tree.nodes[QUIZ_NEW].parent!;
export const QUIZ_SIDE = tree.nodes[QUIZ_PARENT].left === QUIZ_NEW ? 'trái' : 'phải';

// Bước: 0 Tìm, 1 Chèn, 2 Duyệt theo thứ tự, 3 Truy vấn khoảng, 4 Khoá đã sort, 5 Tóm tắt.
export const QUIZ: QuizQuestion[] = [
  {
    step: 1,
    prompt: `Chèn lần lượt ${QUIZ_KEYS.join(', ')} vào một cây rỗng. ${QUIZ_NEW} nằm ở đâu?`,
    choices: [
      `Con ${QUIZ_SIDE} của ${QUIZ_PARENT}`,
      `Con ${QUIZ_SIDE === 'trái' ? 'phải' : 'trái'} của ${QUIZ_PARENT}`,
      `Con trái của ${QUIZ_KEYS[2]}`,
    ],
    correct: 0,
    explain: `${QUIZ_KEYS[0]} thành gốc. ${QUIZ_NEW} < ${QUIZ_KEYS[0]} nên sang trái, gặp ${QUIZ_PARENT}; ${QUIZ_NEW} > ${QUIZ_PARENT} nên sang phải, chỗ đó trống nên gắn vào.`,
  },
  {
    step: 5,
    prompt:
      'Cây có 1.000 node và cân bằng (mọi tầng đều đầy). Tìm một khoá cần so nhiều nhất bao nhiêu lần?',
    choices: [String(balancedHeight(1000)), '1.000', '500'],
    correct: 0,
    explain: `Số lần so nhiều nhất bằng chiều cao cây. Cây cân bằng có tầng k chứa 2ᵏ node, nên 1.000 node chỉ cần ${balancedHeight(1000)} tầng (2¹⁰ = 1.024).`,
  },
  {
    step: 2,
    prompt: 'Duyệt in-order (cây con trái, node, cây con phải) một BST bất kỳ cho ra gì?',
    choices: [
      'Mọi khoá theo thứ tự tăng dần',
      'Mọi khoá theo thứ tự đã chèn',
      'Mọi khoá theo từng tầng, từ gốc xuống',
    ],
    correct: 0,
    explain:
      'Mọi khoá bên trái nhỏ hơn node, mọi khoá bên phải lớn hơn. In hết bên trái, rồi node, rồi bên phải thì ra đúng thứ tự tăng dần, dù cây có hình dạng thế nào.',
  },
  {
    step: 4,
    prompt:
      'Bảng events có event_id tự tăng. Nếu index là một BST thường và chèn 1 triệu dòng theo thứ tự id, cây sẽ thế nào?',
    choices: [
      'Thành một chuỗi cao 1 triệu tầng: tìm tốn O(n)',
      'Cân bằng, cao khoảng 20 tầng',
      'Cao đúng 2 tầng',
    ],
    correct: 0,
    explain:
      'Khoá mới luôn lớn hơn mọi khoá cũ nên luôn gắn vào bên phải node cuối: cây thành một chuỗi. Vì vậy database dùng cây tự cân bằng như B-tree, chiều cao luôn khoảng log n.',
  },
];
