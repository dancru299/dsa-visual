import type { ReactNode } from 'react';

export type Tone = 'good' | 'bad';

export type Metric = { label: string; value: string; tone?: Tone };

// Hiệu ứng không phải state: pháo hoa khi tìm thấy, rung khi sai, khối rơi vào so le.
// target là id của phần tử trong scene, ví dụ 'cell-12'.
export type Fx =
  | { kind: 'burst' | 'shake'; target: string }
  | { kind: 'stagger'; targets: string[]; stepMs: number };

// Câu đoán. Player dừng ngay trước frame chứa câu này; chính frame đó là đáp án.
export type Ask = { prompt: string; choices: string[]; correct: number; explain: string };

// Một khoảnh khắc trong animation. S là state của scene, E là event của thuật toán.
export type Frame<S, E = unknown> = {
  state: S; // snapshot đầy đủ, không dùng chung tham chiếu với frame khác
  event: E; // điều vừa xảy ra; algorithm ghi, lesson đọc để viết lời dẫn

  // Các trường dưới đây do lesson.tsx thêm vào. Algorithm không biết tới chúng.
  say?: string; // câu trong bong bóng
  sayTone?: Tone;
  codeLines?: number[]; // dòng đang chạy trong đoạn code hiển thị trên trang
  metrics?: Metric[];
  fx?: Fx[];
  holdMs?: number; // thời gian dừng ở frame này khi đang Play
  ask?: Ask;
};

export type SceneProps<S> = {
  frame: Frame<S>;
  animate: boolean; // false khi tua, nhảy bước, hoặc khi bật giảm chuyển động
};

// Viết dạng hàm (không dùng ComponentType) để scene nhận state rộng hơn vẫn gán được cho bước
// có state hẹp hơn, ví dụ scene nhận TrackState dùng cho bước có BSState.
export type SceneComponent<S> = (props: SceneProps<S>) => ReactNode;

export type Callout = {
  kind: 'key' | 'warn' | 'de' | 'think';
  title: string;
  text: ReactNode;
  answer?: ReactNode;
};

export type Swatch = 'lav' | 'mint' | 'sun' | 'rose' | 'sky' | 'peach' | 'ash';

export type Step<S, E = unknown> = {
  id: string;
  short: string; // nhãn trên thanh bước
  tag: string; // nhãn nhỏ trên thẻ giải thích, ví dụ 'Ý TƯỞNG'
  tone: Exclude<Swatch, 'ash'>;
  title: string;
  Body: (props: { frames: Frame<S, E>[] }) => ReactNode; // đoạn giải thích, lấy số từ trace
  callout?: Callout;
  Scene: SceneComponent<S>; // mỗi step tự chọn scene
  build: () => Frame<S, E>[]; // đoạn frame của bước này
};

export type LegendItem = { swatch: Swatch; label: string } | { dashed: true; label: string };

// Phần nội dung chạy trên trình duyệt của một bài. Tên, thời lượng, phần cần biết trước...
// nằm trong src/lessons/catalog.ts để trang server đọc được mà không phải tải component.
export type Lesson = {
  slug: string;
  // Mỗi step có kiểu state riêng nên mảng phải dùng any; defineStep kiểm tra kiểu bên trong từng step.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  steps: Step<any, any>[];
  legend: LegendItem[];
  // step: chỉ số của bước mà khi đã xem tới thì coi như học xong mục này.
  objectives: { text: string; step: number }[];
};

export const defineStep = <S, E>(step: Step<S, E>) => step;
