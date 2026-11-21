import type { QuizQuestion } from '@/src/engine/types';
import { build, MAX_KEYS, slotOf } from './algorithm';

export const NODE_KEYS = [20, 50, 80];
export const LOOK_FOR = 65;
export const CHILD = slotOf(NODE_KEYS, LOOK_FOR) + 1; // con thứ mấy, đếm từ 1

export const LEAF = [12, 18, 25];
export const NEW_KEY = 21;
const split = build([...LEAF, NEW_KEY]);
export const PROMOTED = split.nodes[split.root].keys[0];

// Bước: 0 Tìm, 1 Chèn và tách, 2 Gốc tách, 3 Khoá đã sort, 4 Một node một trang, 5 Tóm tắt.
export const QUIZ: QuizQuestion[] = [
  {
    step: 0,
    prompt: `Một node chứa [${NODE_KEYS.join(', ')}] nên có ${NODE_KEYS.length + 1} con. Tìm ${LOOK_FOR} thì xuống con thứ mấy (đếm từ 1)?`,
    choices: [`Con thứ ${CHILD}`, `Con thứ ${CHILD - 1}`, `Con thứ ${CHILD + 1}`],
    correct: 0,
    explain: `${NODE_KEYS.length} khoá chia trục số thành ${NODE_KEYS.length + 1} khoảng, mỗi khoảng là một con. ${NODE_KEYS[CHILD - 2]} < ${LOOK_FOR} < ${NODE_KEYS[CHILD - 1]}, nên ${LOOK_FOR} chỉ có thể nằm ở con thứ ${CHILD}.`,
  },
  {
    step: 1,
    prompt: `Mỗi node tối đa ${MAX_KEYS} khoá. Lá [${LEAF.join(', ')}] nhận thêm ${NEW_KEY}. Tách xong, khoá nào đi lên node cha?`,
    choices: [String(PROMOTED), String(LEAF[1]), String(LEAF[2])],
    correct: 0,
    explain: `Lá thành [${[...LEAF, NEW_KEY].sort((a, b) => a - b).join(', ')}], quá ${MAX_KEYS} khoá. Khoá ở vị trí giữa (len // 2) là ${PROMOTED}: nó đi lên cha, phần bên trái và bên phải thành hai lá riêng.`,
  },
  {
    step: 2,
    prompt: 'Khi nào một B-tree cao thêm một tầng?',
    choices: ['Khi gốc bị tách', 'Khi một lá bị tách', 'Mỗi lần chèn vào lá ngoài cùng bên phải'],
    correct: 0,
    explain:
      'Tách lá chỉ thêm một khoá vào node cha. Chỉ khi việc tách lan tới gốc thì mới có gốc mới ở trên cùng. Cây cao lên từ gốc nên mọi lá luôn cùng độ sâu.',
  },
  {
    step: 3,
    prompt:
      'Index B-tree trên cột created_at, dữ liệu đến theo thời gian tăng dần. Cây sẽ thế nào?',
    choices: [
      'Vẫn cân bằng, chiều cao tăng rất chậm',
      'Thành một chuỗi giống BST',
      'Phải dựng lại sau mỗi lần chèn',
    ],
    correct: 0,
    explain:
      'Khoá tăng dần luôn chèn vào lá bên phải nhất; lá đó đầy thì tách, việc tách có thể lan lên trên, nhưng cây chỉ cao thêm khi gốc tách. Chiều cao vẫn khoảng log n.',
  },
  {
    step: 4,
    prompt: 'Vì sao node của index trong database chứa hàng trăm khoá, chứ không chỉ 1 hay 2?',
    choices: [
      'Mỗi node là một trang trên đĩa; đọc một trang tốn gần như nhau dù trang chứa bao nhiêu khoá',
      'Để tiết kiệm RAM',
      'Vì so sánh nhiều khoá một lúc nhanh hơn so từng khoá',
    ],
    correct: 0,
    explain:
      'Chi phí lớn nhất là số lần đọc trang. Nhét nhiều khoá vào một trang làm cây rất thấp, nên tra một dòng chỉ cần đọc vài trang. So sánh các khoá trong trang đã nằm trong bộ nhớ thì rẻ hơn nhiều.',
  },
];
