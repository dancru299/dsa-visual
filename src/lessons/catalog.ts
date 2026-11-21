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
      {
        slug: 'queue',
        title: 'Queue và ring buffer',
        built: true,
        minutes: 7,
        level: 'Cơ bản',
        summary:
          'Hàng đợi vào trước ra trước, vì sao list.pop(0) chậm, và ring buffer: bộ đệm cố định giữa producer với consumer, kèm backpressure khi đầy.',
        prerequisites: ['Python: list, append() và pop()', 'Bài Stack: push và pop'],
      },
    ],
  },
  {
    id: 'hashing',
    name: '03. Hashing',
    color: '#f4b8b0',
    lessons: [
      {
        slug: 'hash-table',
        title: 'Hash table',
        built: true,
        minutes: 8,
        level: 'Cơ bản',
        summary:
          'Hàm hash biến key thành số ngăn để tra cứu O(1). Va chạm, resize, và cách GROUP BY, hash join, data skew đều đi ra từ đây.',
        prerequisites: ['Python: dict, vòng lặp for', 'Bài Big-O: O(1), O(n), O(n²)'],
      },
    ],
  },
  {
    id: 'sap-xep',
    name: '04. Sắp xếp',
    color: '#f7c696',
    lessons: [
      {
        slug: 'merge-sort',
        title: 'Merge sort',
        built: true,
        minutes: 8,
        level: 'Cơ bản',
        summary:
          'Chia đôi tới khi còn 1 phần tử rồi trộn lại: O(n log n). Cùng ý tưởng trộn đó là sort-merge join và external sort.',
        prerequisites: ['Python: list, slicing, vòng lặp while', 'Bài Big-O và bài Binary Search'],
      },
    ],
  },
  {
    id: 'cay',
    name: '05. Cây',
    color: '#bad5f2',
    lessons: [
      {
        slug: 'heap',
        title: 'Heap và priority queue',
        built: true,
        minutes: 8,
        level: 'Cơ bản',
        summary:
          'Một cái cây nằm gọn trong list: luôn biết ngay số nhỏ nhất, push và pop O(log n). Dùng để lấy Top-K trên dòng dữ liệu và trộn k file đã sort.',
        prerequisites: ['Python: list và index', 'Bài Big-O và bài Merge sort'],
      },
      {
        slug: 'binary-search-tree',
        title: 'Binary Search Tree',
        built: true,
        minutes: 8,
        level: 'Cơ bản',
        summary:
          'Cây mà mỗi node chia khoá thành bên nhỏ hơn và bên lớn hơn: tìm, chèn, duyệt theo thứ tự, truy vấn khoảng, và vì sao dữ liệu đến đã sort làm cây thành một chuỗi.',
        prerequisites: ['Bài Binary Search', 'Python: class, None và hàm đệ quy'],
      },
      {
        slug: 'b-tree',
        title: 'B-tree',
        built: true,
        minutes: 10,
        level: 'Trung bình',
        summary:
          'Mỗi node chứa nhiều khoá và tách đôi khi đầy, nên cây luôn cân bằng và rất thấp. Đó là cấu trúc của index trong Postgres và MySQL.',
        prerequisites: ['Bài Binary Search Tree', 'Bài Big-O: O(log n)'],
      },
    ],
  },
  {
    id: 'do-thi',
    name: '06. Đồ thị',
    color: '#f6d77b',
    lessons: [
      {
        slug: 'bfs-dfs',
        title: 'BFS và DFS',
        built: true,
        minutes: 9,
        level: 'Cơ bản',
        summary:
          'Lineage của dbt là một đồ thị. BFS lan ra từng lớp để tìm bảng bị ảnh hưởng, DFS đi sâu rồi quay lui; cả hai cần tập seen để không làm lại việc.',
        prerequisites: ['Python: dict, list, set và hàm đệ quy', 'Bài Stack và bài Queue'],
      },
      {
        slug: 'topological-sort',
        title: 'Topological sort',
        built: true,
        minutes: 9,
        level: 'Cơ bản',
        summary:
          'Xếp thứ tự chạy cho một DAG như dbt hay Airflow: bảng nào hết phải chờ thì chạy, đợt nào chạy song song được, và cách phát hiện vòng.',
        prerequisites: ['Python: dict, set và deque', 'Bài BFS và DFS'],
      },
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
