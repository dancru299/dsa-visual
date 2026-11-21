// Danh sách bài của bản 1.0, theo bảng trong plan. Chỉ chứa dữ liệu thuần, không có component,
// để trang server, sidebar và generateStaticParams đọc được mà không tải nội dung bài.

export type LessonMeta = {
  slug: string;
  title: string;
  built: boolean; // false: bài đã có trong kế hoạch nhưng chưa làm
  minutes?: number;
  level?: string;
  summary?: string;
  prerequisites?: string[];
};

export type ModuleMeta = { id: string; name: string; color: string; lessons: LessonMeta[] };

export const COURSE: ModuleMeta[] = [
  {
    id: 'nen-tang',
    name: '00. Nền tảng',
    color: '#f7c696',
    lessons: [
      {
        slug: 'big-o',
        title: 'Big-O qua chi phí đọc dữ liệu',
        built: true,
        minutes: 5,
        level: 'Nhập môn',
        summary:
          'Big-O đếm số bước khi bảng lớn dần: vì sao full scan chậm dần, tra index chỉ thêm vài bước, còn JOIN so mọi cặp thì không chạy nổi.',
        prerequisites: ['Python: list và index', 'SQL: SELECT … WHERE và JOIN'],
      },
    ],
  },
  {
    id: 'tim-kiem',
    name: '01. Tìm kiếm',
    color: '#bde3b1',
    lessons: [
      {
        slug: 'binary-search',
        title: 'Binary Search',
        built: true,
        minutes: 8,
        level: 'Cơ bản',
        summary:
          'Mỗi lần so sánh loại cả nửa mảng. Vì sao tìm trong 1 tỷ phần tử chỉ cần khoảng 30 bước.',
        prerequisites: [
          'Python: list, index bắt đầu từ 0, vòng lặp while',
          'Mảng đã sort tăng dần là gì',
        ],
      },
    ],
  },
  {
    id: 'tuyen-tinh',
    name: '02. Cấu trúc tuyến tính',
    color: '#cdc2ec',
    lessons: [
      {
        slug: 'stack',
        title: 'Stack',
        built: true,
        minutes: 6,
        level: 'Cơ bản',
        summary:
          'Cấu trúc vào sau, ra trước. Dùng để kiểm tra ngoặc, và chính là cách Python theo dõi các lời gọi hàm.',
        prerequisites: ['Python: list, append() và pop()', 'Hàm gọi hàm khác và return'],
      },
      { slug: 'queue', title: 'Queue và ring buffer', built: false },
    ],
  },
  {
    id: 'hashing',
    name: '03. Hashing',
    color: '#f4b8b0',
    lessons: [{ slug: 'hash-table', title: 'Hash table', built: false }],
  },
  {
    id: 'sap-xep',
    name: '04. Sắp xếp',
    color: '#f7c696',
    lessons: [{ slug: 'merge-sort', title: 'Merge sort', built: false }],
  },
  {
    id: 'cay',
    name: '05. Cây',
    color: '#bad5f2',
    lessons: [
      { slug: 'heap', title: 'Heap', built: false },
      { slug: 'binary-search-tree', title: 'Binary Search Tree', built: false },
      { slug: 'b-tree', title: 'B-tree', built: false },
    ],
  },
  {
    id: 'do-thi',
    name: '06. Đồ thị',
    color: '#f6d77b',
    lessons: [
      { slug: 'bfs-dfs', title: 'BFS và DFS', built: false },
      { slug: 'topological-sort', title: 'Topological sort', built: false },
      { slug: 'union-find', title: 'Union-Find', built: false },
    ],
  },
  {
    id: 'xac-suat',
    name: '07. Xác suất',
    color: '#cdc2ec',
    lessons: [{ slug: 'bloom-filter', title: 'Bloom filter', built: false }],
  },
];

export type LessonEntry = LessonMeta & {
  module: Pick<ModuleMeta, 'id' | 'name'>;
  position: number; // thứ tự trong module, bắt đầu từ 1
  moduleSize: number;
};

const ENTRIES: LessonEntry[] = COURSE.flatMap((m) =>
  m.lessons.map((l, i) => ({
    ...l,
    module: { id: m.id, name: m.name },
    position: i + 1,
    moduleSize: m.lessons.length,
  })),
);

export const BUILT_LESSONS = ENTRIES.filter((l) => l.built);

export const findLesson = (slug: string) => BUILT_LESSONS.find((l) => l.slug === slug);

export function nextBuiltLesson(slug: string): LessonEntry | undefined {
  const i = BUILT_LESSONS.findIndex((l) => l.slug === slug);
  return i >= 0 ? BUILT_LESSONS[i + 1] : undefined;
}

export const lessonHref = (slug: string) => `/learn/${slug}`;
