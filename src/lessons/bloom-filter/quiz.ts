import type { QuizQuestion } from '@/src/engine/types';

export const USERS = 10_000_000;
export const BITS_EACH = 10;
// Bộ nhớ theo MB (1 MB = 10⁶ byte), viết theo kiểu Việt Nam: dấu phẩy thập phân.
export const MEGABYTES = (USERS * BITS_EACH) / 8 / 1e6;
const mb = (x: number) => `Khoảng ${String(x).replace('.', ',')} MB`;

// Bước: 0 Thêm, 1 Không có, 2 Dương tính giả, 3 Không xoá được, 4 Kích thước, 5 Parquet.
export const QUIZ: QuizQuestion[] = [
  {
    step: 1,
    prompt:
      'Một Bloom filter (chưa từng bị xoá gì) trả lời "chắc chắn không có". Câu trả lời đó có thể sai không?',
    choices: [
      'Không: phần tử đã thêm thì mọi bit của nó đều đang bật',
      'Có, thỉnh thoảng vẫn sai',
      'Chỉ sai khi filter gần đầy',
    ],
    correct: 0,
    explain:
      'Thêm chỉ bật bit, không bao giờ tắt. Nếu phần tử từng được thêm thì k bit của nó chắc chắn là 1; thấy một bit 0 là đủ chắc nó chưa từng được thêm.',
  },
  {
    step: 2,
    prompt: 'Filter trả lời "có thể có". Bước tiếp theo nên làm gì?',
    choices: [
      'Kiểm tra dữ liệu thật để biết chắc',
      'Coi như chắc chắn có',
      'Hỏi lại filter thêm lần nữa',
    ],
    correct: 0,
    explain:
      'Các bit có thể do những phần tử khác bật. Filter chỉ giúp bỏ qua phần chắc chắn không có; phần "có thể có" vẫn phải đọc dữ liệu thật. Hỏi lại thì vẫn ra đúng câu trả lời cũ.',
  },
  {
    step: 3,
    prompt: 'Vì sao không thể xoá một phần tử khỏi Bloom filter bằng cách tắt các bit của nó?',
    choices: [
      'Bit có thể dùng chung với phần tử khác; tắt đi thì filter bỏ sót chúng',
      'Vì mảng bit chỉ đọc, không ghi được',
      'Vì tắt bit tốn quá nhiều thời gian',
    ],
    correct: 0,
    explain:
      'Filter không biết bit nào của phần tử nào. Tắt bit của một phần tử có thể làm phần tử khác thiếu bit, và filter trả lời "chắc chắn không có" cho thứ đang có thật: lỗi tệ nhất.',
  },
  {
    step: 4,
    prompt: `Cần filter cho 10 triệu user_id, khoảng ${BITS_EACH} bit mỗi khoá để tỉ lệ sai khoảng 1%. Filter tốn bao nhiêu bộ nhớ?`,
    choices: [mb(MEGABYTES), mb(MEGABYTES * 8), mb(MEGABYTES / 10)],
    correct: 0,
    explain: `10 triệu × ${BITS_EACH} bit = 100 triệu bit, chia 8 thành ${String(MEGABYTES).replace('.', ',')} triệu byte. Lưu thẳng 10 triệu id, mỗi id 8 byte, đã tốn 80 MB.`,
  },
  {
    step: 5,
    prompt:
      "Đọc một file Parquet có bloom filter trên customer_id, với WHERE customer_id = 'c999'. Row group nào vẫn phải đọc?",
    choices: [
      'Những row group mà filter trả lời "có thể có"',
      'Tất cả row group',
      'Không row group nào, filter đã trả lời đủ',
    ],
    correct: 0,
    explain:
      'Row group "chắc chắn không có" được bỏ qua mà không cần đọc. Row group "có thể có" vẫn phải đọc để biết thật sự có hay đó là dương tính giả.',
  },
];
