import type { QuizQuestion } from '@/src/engine/types';

export const LEFT_SIZE = 3;
export const RIGHT_SIZE = 5;

// Bước: 0 Chia đôi, 1 Trộn, 2 Cả quá trình, 3 Vì sao n log n, 4 Merge join, 5 Tóm tắt.
export const QUIZ: QuizQuestion[] = [
  {
    step: 3,
    prompt: 'Merge sort 1 triệu phần tử cần cỡ bao nhiêu lần so sánh?',
    choices: ['Khoảng 20 triệu (n log₂ n)', 'Khoảng 1 nghìn tỷ (n²)', 'Khoảng 1 triệu (n)'],
    correct: 0,
    explain:
      'Chia đôi 1 triệu khoảng 20 lần thì còn từng phần tử, nên có khoảng 20 tầng trộn. Mỗi tầng chạm mọi phần tử một lần: 1 triệu × 20 = 20 triệu.',
  },
  {
    step: 1,
    prompt: `Trộn hai dãy đã sort, một dãy ${LEFT_SIZE} phần tử và một dãy ${RIGHT_SIZE} phần tử. Cần nhiều nhất bao nhiêu lần so?`,
    choices: [
      String(LEFT_SIZE + RIGHT_SIZE - 1),
      String(LEFT_SIZE * RIGHT_SIZE),
      String(LEFT_SIZE + RIGHT_SIZE),
    ],
    correct: 0,
    explain: `Mỗi lần so đưa một phần tử vào kết quả. Khi một dãy hết, phần còn lại chép thẳng mà không cần so, nên nhiều nhất là ${LEFT_SIZE} + ${RIGHT_SIZE} − 1 = ${LEFT_SIZE + RIGHT_SIZE - 1} lần.`,
  },
  {
    step: 4,
    prompt: 'Cần sort 100 GB log trên một máy chỉ có 8 GB RAM. Làm thế nào?',
    choices: [
      'Sort từng phần vừa RAM, ghi ra đĩa, rồi trộn các phần đã sort',
      'Không sort được, phải có máy nhiều RAM hơn',
      'Đọc hết vào một list rồi gọi sorted()',
    ],
    correct: 0,
    explain:
      'Đó là external sort: chia thành các phần vừa RAM, sort từng phần rồi ghi ra file, sau đó trộn các file đã sort. Bước trộn chỉ cần giữ đầu của mỗi file trong RAM.',
  },
  {
    step: 4,
    prompt: 'Sort-merge join cần điều kiện gì trước khi bắt đầu trộn?',
    choices: [
      'Cả hai bảng đã sort theo khoá join',
      'Một trong hai bảng phải vừa RAM',
      'Khoá join phải là số nguyên',
    ],
    correct: 0,
    explain:
      'Hai con trỏ chỉ tiến, không lùi, nên phải chắc rằng khoá phía sau không bao giờ nhỏ hơn khoá phía trước. Cần một bảng vừa RAM là điều kiện của hash join, không phải của sort-merge join.',
  },
];
