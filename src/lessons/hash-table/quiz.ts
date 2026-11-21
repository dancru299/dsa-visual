import type { QuizQuestion } from '@/src/engine/types';

export const BUCKETS = 8;
export const HASH = 21;

// Bước: 0 Hàm hash, 1 Tra cứu, 2 Va chạm, 3 Resize, 4 GROUP BY, 5 Hash lệch.
export const QUIZ: QuizQuestion[] = [
  {
    step: 0,
    prompt: `Hash table có ${BUCKETS} ngăn, hash(key) = ${HASH}. Key nằm ở ngăn nào?`,
    choices: [String(HASH % BUCKETS), String(HASH), String(Math.floor(HASH / BUCKETS))],
    correct: 0,
    explain: `Ngăn = hash % số ngăn = ${HASH} % ${BUCKETS} = ${HASH % BUCKETS}. Phép % đưa mọi giá trị hash về khoảng 0 tới ${BUCKETS - 1}.`,
  },
  {
    step: 2,
    prompt:
      'Hàm hash kém làm một ngăn chứa 1.000 key, các ngăn khác gần như trống. Tra một key nằm trong ngăn đó tốn bao nhiêu?',
    choices: [
      'Duyệt chuỗi trong ngăn: tới 1.000 lần so',
      'Một lần so như mọi khi',
      'Khoảng 10 lần so, vì log₂ 1.000 ≈ 10',
    ],
    correct: 0,
    explain:
      'Hash chỉ đưa bạn tới đúng ngăn. Trong ngăn, các key va chạm nằm thành một chuỗi không sort, nên phải so lần lượt. O(1) chỉ đúng khi key rải đều giữa các ngăn.',
  },
  {
    step: 3,
    prompt: `Bảng ${BUCKETS} ngăn đang chứa 12 key. Vì sao nên resize lên ${BUCKETS * 2} ngăn?`,
    choices: [
      `Hệ số tải 12/${BUCKETS} = 1,5: chuỗi dài dần, tra chậm đi`,
      `Vì ${BUCKETS} ngăn chỉ chứa được ${BUCKETS} key`,
      'Để các key được sort',
    ],
    correct: 0,
    explain:
      'Chaining không có giới hạn cứng, ngăn nào cũng chứa thêm được. Nhưng trung bình mỗi ngăn đã có 1,5 key và sẽ còn tăng. Resize đưa hệ số tải xuống để tra vẫn O(1) trung bình.',
  },
  {
    step: 5,
    prompt:
      'JOIN orders với customers theo customer_id trên Spark, và một khách hàng chiếm 40% số đơn. Chuyện gì xảy ra?',
    choices: [
      'Một task nhận 40% số đơn, cả job phải chờ task đó (data skew)',
      'Spark tự chia đều khách hàng đó cho mọi task',
      'Không sao, hash luôn chia đều',
    ],
    correct: 0,
    explain:
      'Mọi dòng cùng customer_id có cùng hash nên về cùng một partition. Một task làm gần nửa việc, các task khác xong sớm rồi ngồi chờ. Cách hay dùng: thêm salt vào khoá, hoặc bật adaptive query execution (AQE) để Spark tách partition lệch.',
  },
];
