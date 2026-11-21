import { defineStep, type Ask, type Frame, type Lesson, type Metric } from '@/src/engine/types';
import { codeTraceScene, type CodeTraceState } from '@/src/scenes/CodeTraceScene';
import { graphScene, type GraphLayout } from '@/src/scenes/GraphScene';
import {
  edgeKey,
  parentsOf,
  traceIndegree,
  traceKahn,
  traceTopoDfs,
  traceWaves,
  waveNumberBruteForce,
  type Graph,
  type TopoEvent,
  type TopoState,
} from './algorithm';
import { QUIZ } from './quiz';

// ---------- Dữ liệu ----------

// Lineage kiểu một project dbt, cùng đồ thị với trang thử /lab/graph. fct_orders phụ thuộc hai
// bảng ở hai độ sâu khác nhau, nên phải chờ bảng chậm hơn.
export const GRAPH: Graph = {
  raw_orders: ['stg_orders'],
  stg_orders: ['orders_snapshot', 'fct_orders'],
  raw_customers: ['stg_customers'],
  stg_customers: ['dim_customers'],
  dim_customers: ['fct_orders', 'churn_model'],
  fct_orders: ['revenue_dashboard'],
};
export const TABLES = [
  'raw_orders',
  'raw_customers',
  'stg_orders',
  'stg_customers',
  'orders_snapshot',
  'dim_customers',
  'fct_orders',
  'churn_model',
  'revenue_dashboard',
];

// Lỗi hay gặp: dim_customers lấy thêm churn_score từ churn_model, mà churn_model lại build từ
// dim_customers. Hai bảng chờ lẫn nhau.
export const CYCLE_EDGE = { from: 'churn_model', to: 'dim_customers' };
export const CYCLE_GRAPH: Graph = { ...GRAPH, [CYCLE_EDGE.from]: [CYCLE_EDGE.to] };

const edgesOf = (g: Graph, paths: Record<string, string> = {}) =>
  Object.entries(g).flatMap(([from, tos]) =>
    tos.map((to) => ({ from, to, path: paths[edgeKey(from, to)] })),
  );

// Khung rộng: các lớp xếp từ trái sang phải, giống trang thử /lab/graph.
const COL = [76, 246, 416, 586, 756];
const ROW = [45, 145, 245];
const WIDE_NODES = [
  { id: 'raw_orders', x: COL[0], y: ROW[0] },
  { id: 'raw_customers', x: COL[0], y: ROW[2] },
  { id: 'stg_orders', x: COL[1], y: ROW[0] },
  { id: 'stg_customers', x: COL[1], y: ROW[2] },
  { id: 'orders_snapshot', x: COL[2], y: ROW[0] },
  { id: 'dim_customers', x: COL[2], y: ROW[2] },
  { id: 'fct_orders', x: COL[3], y: ROW[1] },
  { id: 'churn_model', x: COL[3], y: ROW[2] },
  { id: 'revenue_dashboard', x: COL[4], y: ROW[1] },
].map((n) => ({ ...n, label: n.id }));

// Khung hẹp: từ trên xuống, mỗi hàng nhiều nhất 2 bảng. fct_orders nằm giữa để cạnh từ
// stg_orders chạy trong khe giữa hai cột, không chui dưới orders_snapshot.
const NARROW_NODES = [
  { id: 'raw_orders', x: 75, y: 30 },
  { id: 'raw_customers', x: 255, y: 30 },
  { id: 'stg_orders', x: 75, y: 100 },
  { id: 'stg_customers', x: 255, y: 100 },
  { id: 'orders_snapshot', x: 75, y: 170 },
  { id: 'dim_customers', x: 255, y: 170 },
  { id: 'fct_orders', x: 165, y: 240 },
  { id: 'revenue_dashboard', x: 75, y: 310 },
  { id: 'churn_model', x: 255, y: 310 },
].map((n) => ({ ...n, label: n.id }));

const wide = (g: Graph, paths?: Record<string, string>): GraphLayout => ({
  width: 832,
  height: 290,
  nodes: WIDE_NODES,
  edges: edgesOf(g, paths),
});

const narrow = (g: Graph, paths?: Record<string, string>): GraphLayout => ({
  width: 330,
  height: 340,
  flow: 'down',
  nodeWidth: 136,
  nodeHeight: 32,
  bend: 16,
  nodes: NARROW_NODES,
  edges: edgesOf(g, paths),
});

// Hai cạnh ngược chiều giữa dim_customers và churn_model vẽ song song, lệch nhau một chút.
const there = edgeKey(CYCLE_EDGE.to, CYCLE_EDGE.from);
const back = edgeKey(CYCLE_EDGE.from, CYCLE_EDGE.to);
const WIDE_CYCLE_PATHS = { [there]: 'M482,241 L514,241', [back]: 'M520,255 L488,255' };
const NARROW_CYCLE_PATHS = { [there]: 'M250,186 L250,288', [back]: 'M290,294 L290,192' };

// ---------- Code hiển thị trên trang ----------

export const CODE_INDEGREE = [
  'indegree = {table: 0 for table in tables}',
  'for table in graph:',
  '    for child in graph[table]:',
  '        indegree[child] += 1',
  'ready = [t for t in tables if indegree[t] == 0]',
];

export const CODE_KAHN = [
  'from collections import deque',
  '',
  'def topo_sort(graph, indegree):',
  '    ready = deque(t for t in indegree if indegree[t] == 0)',
  '    order = []',
  '    while ready:',
  '        table = ready.popleft()',
  '        order.append(table)',
  '        for child in graph.get(table, []):',
  '            indegree[child] -= 1',
  '            if indegree[child] == 0:',
  '                ready.append(child)',
  '    if len(order) < len(indegree):',
  "        raise ValueError('có vòng')",
  '    return order',
];

const CODE_WAVES = [
  'def waves(graph, indegree):',
  '    wave = [t for t in indegree if indegree[t] == 0]',
  '    while wave:',
  '        yield wave                        # cả đợt chạy song song',
  '        nxt = []',
  '        for table in wave:',
  '            for child in graph.get(table, []):',
  '                indegree[child] -= 1',
  '                if indegree[child] == 0:',
  '                    nxt.append(child)',
  '        wave = nxt',
];

export const CODE_DFS = [
  'def topo_dfs(graph, tables):',
  '    seen, finished = set(), []',
  '    def visit(table):',
  '        seen.add(table)',
  '        for child in graph.get(table, []):',
  '            if child not in seen:',
  '                visit(child)',
  '        finished.append(table)    # mọi bảng phía sau đã xong',
  '    for table in tables:',
  '        if table not in seen:',
  '            visit(table)',
  '    return finished[::-1]',
];

// deps của graphlib sinh từ chính GRAPH: mỗi bảng → các bảng nó phụ thuộc (ngược chiều mũi tên).
const DEPENDENT = TABLES.filter((t) => parentsOf(GRAPH, t).length > 0);
const DEP_WIDTH = Math.max(...DEPENDENT.map((t) => t.length)) + 3;
export const CODE_GRAPHLIB = [
  'from graphlib import TopologicalSorter',
  '',
  'deps = {                  # bảng → các bảng nó phụ thuộc',
  ...DEPENDENT.map(
    (t) =>
      `    ${`'${t}':`.padEnd(DEP_WIDTH)} {${parentsOf(GRAPH, t)
        .map((p) => `'${p}'`)
        .join(', ')}},`,
  ),
  '}',
  'ts = TopologicalSorter(deps)',
  'ts.prepare()',
  'while ts.is_active():',
  '    ready = ts.get_ready()    # cả đợt đang sẵn sàng',
  '    for table in ready:',
  '        run(table)',
  '        ts.done(table)',
];
const GET_READY = CODE_GRAPHLIB.findIndex((l) => l.includes('get_ready')) + 1;

// ---------- Tiện ích ----------

type F = Frame<TopoState, TopoEvent>;

const withAsk = (frames: F[], at: number, ask: Ask) =>
  frames.map((f, k) => (k === at ? { ...f, ask } : f));

const setSay = (frames: F[], k: number, say: string, extra: Partial<F> = {}) => {
  frames[k] = { ...frames[k], say, ...extra };
};

const currentOf = (s: TopoState) => TABLES.find((t) => s.marks[t] === 'current');

// ---------- Bước 1: bậc vào ----------

const EDGE_COUNT = edgesOf(GRAPH).length;
export const SOURCES = TABLES.filter((t) => parentsOf(GRAPH, t).length === 0);
const LEAVES = TABLES.filter((t) => (GRAPH[t] ?? []).length === 0);

export const INDEGREE = (() => {
  const frames = traceIndegree(GRAPH, TABLES).map((f, k): F => {
    const e = f.event;
    const metrics: Metric[] = [
      // frame 0 là lúc bắt đầu, frame cuối là lúc xong; mỗi frame ở giữa đếm một cạnh
      { label: 'Cạnh đã đếm', value: `${Math.min(k, EDGE_COUNT)}/${EDGE_COUNT}` },
      { label: 'Đang xét', value: e.kind === 'count' ? e.from : '—' },
      { label: 'Bậc vào 0', value: String(f.state.pending.length) },
      { label: 'Độ phức tạp', value: 'O(V + E)', tone: 'good' },
    ];
    switch (e.kind) {
      case 'start':
        return {
          ...f,
          metrics,
          codeLines: [1],
          say: 'mũi tên u → v: v đọc dữ liệu từ u, nên phải chờ u',
          holdMs: 1500,
        };
      case 'count':
        return {
          ...f,
          metrics,
          codeLines: [2, 3, 4],
          say: `${e.to} phải chờ ${e.from}: bậc vào ${f.state.badges[e.to]}`,
          holdMs: 1100,
        };
      default:
        return {
          ...f,
          metrics,
          codeLines: [5],
          say: `bậc vào 0: ${f.state.pending.join(', ')} chạy được ngay`,
          sayTone: 'good',
          holdMs: 1500,
        };
    }
  });
  return withAsk(frames, frames.length - 1, {
    prompt: 'Đếm xong mọi cạnh. Những bảng nào chạy được ngay, không phải chờ bảng nào?',
    choices: [SOURCES.join(' và '), `Chỉ ${SOURCES[0]}`, LEAVES.join(', ')],
    correct: 0,
    explain: `Bậc vào 0 nghĩa là không phải chờ bảng nào: đó là các bảng nguồn. ${LEAVES.join(', ')} là các bảng cuối: không có mũi tên đi ra, nhưng vẫn phải chờ bảng phía trước.`,
  });
})();

// ---------- Bước 2 và 4: Kahn ----------

function kahnLines(e: TopoEvent): number[] {
  switch (e.kind) {
    case 'start':
      return [4, 5];
    case 'dequeue':
      return [6, 7, 8];
    case 'decrement':
      return e.left === 0 ? [9, 10, 11, 12] : [9, 10, 11];
    case 'stuck':
      return [13, 14];
    case 'done':
      return [13, 15];
    default:
      return [];
  }
}

function narrateKahn(raw: F[]): F[] {
  return raw.map((f) => {
    const e = f.event;
    const s = f.state;
    const base = {
      ...f,
      codeLines: kahnLines(e),
      metrics: [
        { label: 'Đã chạy', value: `${s.order.length}/${TABLES.length}` },
        { label: 'Đang chạy', value: currentOf(s) ?? '—' },
        { label: 'Sẵn sàng', value: String(s.pending.length) },
        { label: 'Độ phức tạp', value: 'O(V + E)', tone: 'good' as const },
      ],
    };
    switch (e.kind) {
      case 'start':
        return { ...base, say: `sẵn sàng: ${s.pending.join(', ')}`, holdMs: 1300 };
      case 'dequeue':
        return { ...base, say: `chạy ${e.node}`, holdMs: 900 };
      case 'decrement':
        return e.left === 0
          ? {
              ...base,
              say: `${e.to}: bậc vào về 0 → sẵn sàng`,
              sayTone: 'good' as const,
              holdMs: 1100,
            }
          : { ...base, say: `${e.to}: bậc vào còn ${e.left}, vẫn phải chờ`, holdMs: 1200 };
      case 'stuck':
        return {
          ...base,
          say: `kẹt: ${e.cycle.join(' → ')}`,
          sayTone: 'bad' as const,
          holdMs: 1800,
        };
      default:
        return {
          ...base,
          say: `xong: ${s.order.length} bảng theo một thứ tự hợp lệ`,
          sayTone: 'good' as const,
          holdMs: 1500,
        };
    }
  });
}

const KAHN_RAW = traceKahn(GRAPH, TABLES);

export const KAHN = (() => {
  const frames = narrateKahn(KAHN_RAW);
  // Câu đoán ở lần đầu một bảng được giảm bậc vào mà vẫn chưa về 0.
  const k = frames.findIndex((f) => f.event.kind === 'decrement' && f.event.left > 0);
  const e = frames[k].event as Extract<TopoEvent, { kind: 'decrement' }>;
  const done = frames[k].state.order;
  const parents = parentsOf(GRAPH, e.to);
  const waiting = parents.filter((p) => !done.includes(p));
  return withAsk(frames, k, {
    prompt: `${e.from} vừa chạy xong. ${e.to} đang có bậc vào ${e.left + 1}. Đưa ${e.to} vào hàng sẵn sàng chưa?`,
    choices: [
      `Chưa, bậc vào còn ${e.left}: vẫn chờ ${waiting.join(', ')}`,
      `Rồi, vì ${e.from} đã chạy xong`,
      'Rồi, nhưng để chạy sau cùng',
    ],
    correct: 0,
    explain: `${e.to} đọc dữ liệu từ cả ${parents.join(' và ')}. Mỗi bảng nó phụ thuộc chạy xong thì bậc vào giảm 1; chỉ khi về 0, tức mọi bảng đó đã xong, nó mới sẵn sàng.`,
  });
})();

// ---------- Bước 3: chia đợt ----------

const WAVES_RAW = traceWaves(GRAPH, TABLES);
const WAVE_OF = waveNumberBruteForce(GRAPH, TABLES);
export const WAVE_COUNT = Math.max(...Object.values(WAVE_OF));

// Đường dài nhất: đi ngược từ bảng ở đợt cuối, mỗi bước về một bảng nguồn ở đợt ngay trước.
export const LONGEST_PATH = (() => {
  const path = [TABLES.find((t) => WAVE_OF[t] === WAVE_COUNT)!];
  while (WAVE_OF[path[0]] > 1) {
    path.unshift(parentsOf(GRAPH, path[0]).find((p) => WAVE_OF[p] === WAVE_OF[path[0]] - 1)!);
  }
  return path;
})();

export const WAVES = (() => {
  const frames = WAVES_RAW.map((f): F => {
    const e = f.event;
    const s = f.state;
    const index = e.kind === 'wave' ? e.index : e.kind === 'done' ? WAVE_COUNT : 0;
    const base = {
      ...f,
      metrics: [
        { label: 'Đợt', value: index === 0 ? '—' : `${index}/${WAVE_COUNT}` },
        { label: 'Chạy song song', value: String(s.pending.length) },
        { label: 'Đã xong', value: `${s.order.length}/${TABLES.length}` },
        { label: 'Đường dài nhất', value: `${LONGEST_PATH.length} bảng` },
      ],
    };
    switch (e.kind) {
      case 'start':
        return {
          ...base,
          codeLines: [2],
          say: 'mỗi đợt: mọi bảng đang sẵn sàng chạy cùng lúc',
          holdMs: 1300,
        };
      case 'wave':
        return {
          ...base,
          codeLines: [3, 4],
          say: `đợt ${e.index}: ${e.nodes.join(', ')}`,
          holdMs: 1600,
        };
      default:
        return {
          ...base,
          codeLines: [3],
          say: `${WAVE_COUNT} đợt cho ${TABLES.length} bảng`,
          sayTone: 'good',
          holdMs: 1500,
        };
    }
  });
  const k = frames.findIndex((f) => f.event.kind === 'wave');
  return withAsk(frames, k, {
    prompt: `Không giới hạn số thread, chạy hết ${TABLES.length} bảng này cần ít nhất mấy đợt?`,
    choices: [String(WAVE_COUNT), String(TABLES.length), String(SOURCES.length)],
    correct: 0,
    explain: `Đường dài nhất là ${LONGEST_PATH.join(' → ')}: ${LONGEST_PATH.length} bảng, bảng sau phải chờ bảng trước. Nên cần ${LONGEST_PATH.length} đợt dù có bao nhiêu thread.`,
  });
})();

// ---------- Bước 4: có vòng ----------

export const CYCLE = (() => {
  const frames = narrateKahn(traceKahn(CYCLE_GRAPH, TABLES));
  setSay(
    frames,
    0,
    `thêm ${CYCLE_EDGE.from} → ${CYCLE_EDGE.to}: ${CYCLE_EDGE.to} lấy thêm churn_score`,
  );
  const k = frames.findIndex((f) => f.event.kind === 'stuck');
  const e = frames[k].event as Extract<TopoEvent, { kind: 'stuck' }>;
  const others = e.left.filter((t) => !e.cycle.includes(t));
  return withAsk(frames, k, {
    prompt: `Hàng sẵn sàng đã rỗng nhưng còn ${e.left.length} bảng chưa chạy, bậc vào đều lớn hơn 0. Nghĩa là gì?`,
    choices: [
      'Có vòng: vài bảng đang chờ lẫn nhau',
      'Các bảng đó không cần chạy',
      'Thuật toán chạy sai',
    ],
    correct: 0,
    explain: `Vòng ${e.cycle.join(' → ')}: mỗi bảng chờ bảng đứng trước nó, nên không bảng nào về 0 được. ${others.join(', ')} kẹt theo vì đứng sau vòng. Số bảng đã chạy ít hơn tổng số bảng là dấu hiệu có vòng.`,
  });
})();

// ---------- Bước 5: DFS ----------

function dfsLines(e: TopoEvent): number[] {
  switch (e.kind) {
    case 'start':
      return [2];
    case 'enter':
      return e.from === null ? [9, 10, 11, 4] : [6, 7, 4];
    case 'skip':
      return [5, 6];
    case 'leave':
      return [8];
    case 'done':
      return [12];
    default:
      return [];
  }
}

const DFS_RAW = traceTopoDfs(GRAPH, TABLES);

export const DFS = (() => {
  const frames = DFS_RAW.map((f): F => {
    const e = f.event;
    const s = f.state;
    const base = {
      ...f,
      codeLines: dfsLines(e),
      metrics: [
        { label: 'Đang ở', value: currentOf(s) ?? '—' },
        { label: 'Độ sâu call stack', value: String(s.pending.length) },
        { label: 'Đã return', value: `${s.order.length}/${TABLES.length}` },
        { label: 'Độ phức tạp', value: 'O(V + E)', tone: 'good' as const },
      ],
    };
    switch (e.kind) {
      case 'start':
        return { ...base, say: 'gọi visit() cho từng bảng chưa thấy', holdMs: 1200 };
      case 'enter':
        return {
          ...base,
          say: e.from === null ? `visit('${e.node}')` : `${e.node} chưa thấy → visit('${e.node}')`,
          holdMs: 1000,
        };
      case 'skip':
        return { ...base, say: `${e.to} đã thấy rồi → bỏ qua`, holdMs: 1000 };
      case 'leave':
        return {
          ...base,
          say: `${e.node} return → thêm vào đầu thứ tự chạy`,
          sayTone: 'good' as const,
          holdMs: 1000,
        };
      default:
        return {
          ...base,
          say: 'đảo ngược thứ tự return là ra thứ tự chạy',
          sayTone: 'good' as const,
          holdMs: 1500,
        };
    }
  });
  const k = frames.findIndex((f) => f.event.kind === 'leave');
  const node = (frames[k].event as Extract<TopoEvent, { kind: 'leave' }>).node;
  return withAsk(frames, k, {
    prompt: `${node} là bảng đầu tiên return, vì không có bảng nào phía sau nó. Trong thứ tự chạy cuối cùng, ${node} đứng ở đâu?`,
    choices: ['Cuối cùng', 'Đầu tiên', `Ngay sau ${parentsOf(GRAPH, node)[0]}`],
    correct: 0,
    explain:
      'Một bảng chỉ return khi mọi bảng phía sau nó đã return. Vậy bảng return trước phải chạy sau: đảo ngược thứ tự return là ra thứ tự chạy. Code ghi vào finished rồi đảo ngược ở cuối; hình thêm vào đầu cho dễ thấy.',
  });
})();

// ---------- Bước 6: tóm tắt ----------

type RowEvent = { kind: 'row'; index: number };

export const RECAP = (() => {
  const waves = WAVES_RAW.flatMap((f) => (f.event.kind === 'wave' ? [f.event.nodes] : []));
  return Array.from({ length: waves.length + 1 }, (_, n): Frame<CodeTraceState, RowEvent> => ({
    state: {
      rows: waves
        .slice(0, n)
        .map((w, i) => [String(i + 1), w.join(', '), waves[i + 1]?.join(', ') ?? '—']),
    },
    event: { kind: 'row', index: n },
    codeLines: n === 0 ? [GET_READY - 3, GET_READY - 2] : [GET_READY, GET_READY + 3],
    holdMs: n === 0 ? 900 : 1300,
    metrics: [
      { label: 'Số bảng (V)', value: String(TABLES.length) },
      { label: 'Số cạnh (E)', value: String(EDGE_COUNT) },
      { label: 'Số đợt', value: String(waves.length) },
      { label: 'Độ phức tạp', value: 'O(V + E)', tone: 'good' },
    ],
  }));
})();

// ---------- Scene ----------

const scene = (
  g: Graph,
  pendingTitle: string,
  orderTitle: string,
  file: string,
  lines: readonly string[],
  cycle = false,
) =>
  graphScene({
    layout: wide(g, cycle ? WIDE_CYCLE_PATHS : undefined),
    narrow: narrow(g, cycle ? NARROW_CYCLE_PATHS : undefined),
    narrowBelow: 720,
    pendingTitle,
    orderTitle,
    code: { file, lines },
  });

const IndegreeScene = scene(
  GRAPH,
  'BẬC VÀO = 0',
  'ĐÃ ĐẾM CẠNH ĐI RA',
  'indegree.py',
  CODE_INDEGREE,
);
const KahnScene = scene(GRAPH, 'SẴN SÀNG (QUEUE)', 'THỨ TỰ CHẠY', 'topo_sort.py', CODE_KAHN);
const WavesScene = scene(GRAPH, 'ĐỢT ĐANG CHẠY', 'ĐÃ XONG', 'waves.py', CODE_WAVES);
const CycleScene = scene(
  CYCLE_GRAPH,
  'SẴN SÀNG (QUEUE)',
  'THỨ TỰ CHẠY',
  'topo_sort.py',
  CODE_KAHN,
  true,
);
const DfsScene = scene(
  GRAPH,
  'CALL STACK (ĐỈNH BÊN PHẢI)',
  'THỨ TỰ CHẠY (THÊM VÀO ĐẦU)',
  'topo_dfs.py',
  CODE_DFS,
);
const RecapScene = codeTraceScene({
  file: 'run_dag.py',
  code: CODE_GRAPHLIB,
  columns: ['đợt', 'get_ready()', 'mở khoá'],
  title: 'CÁC ĐỢT CHẠY CỦA LINEAGE',
});

// ---------- Các bước ----------

const steps = [
  defineStep<TopoState, TopoEvent>({
    id: 'bac-vao',
    short: 'Bậc vào',
    tag: 'KHÁI NIỆM',
    tone: 'mint',
    title: 'Bảng nào phải chờ bảng nào?',
    Scene: IndegreeScene,
    build: () => INDEGREE,
    Body: () => (
      <>
        <p>
          Mỗi mũi tên <code>u → v</code> nghĩa là v đọc dữ liệu từ u, nên v phải chạy sau u. Một thứ
          tự chạy mà mọi mũi tên đều đi từ bảng trước sang bảng sau gọi là <b>thứ tự topo</b>{' '}
          (topological order). Chỉ DAG, đồ thị không có vòng, mới có thứ tự này.
        </p>
        <p>
          Bước đầu là đếm <b>bậc vào</b> (in-degree) của mỗi bảng: số mũi tên đi vào nó, tức số bảng
          nó phải chờ. Số nhỏ ở góc mỗi bảng là bậc vào. Duyệt mọi cạnh một lần: <b>O(V + E)</b>.
        </p>
      </>
    ),
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          dbt dựng DAG này từ các lệnh <code>ref()</code> trong từng model; Airflow dựng từ các dòng{' '}
          <code>task_a &gt;&gt; task_b</code>. Việc xếp thứ tự chạy sau đó chính là topological
          sort.
        </>
      ),
    },
  }),

  defineStep<TopoState, TopoEvent>({
    id: 'kahn',
    short: 'Kahn',
    tag: 'THAO TÁC',
    tone: 'sky',
    title: 'Thuật toán Kahn: chạy bảng nào đã hết phải chờ',
    Scene: KahnScene,
    build: () => KAHN,
    Body: ({ frames }) => {
      const { order } = frames.at(-1)!.state;
      return (
        <>
          <p>
            Đưa mọi bảng có bậc vào 0 vào một queue. Lấy một bảng ra chạy, rồi giảm bậc vào của các
            bảng phía sau nó. Bảng nào về 0 thì đã hết phải chờ: đưa vào queue.
          </p>
          <p>
            Thứ tự chạy: {order.join(', ')}. Mỗi bảng vào queue một lần, mỗi cạnh giảm bậc vào một
            lần: <b>O(V + E)</b>. Đây là BFS của bài trước, chỉ thêm điều kiện bậc vào về 0.
          </p>
        </>
      );
    },
    callout: {
      kind: 'key',
      title: 'Ý CHÍNH',
      text: 'Bậc vào đếm xem một bảng còn chờ bao nhiêu bảng chưa xong. fct_orders đọc từ hai bảng nên phải đợi cả hai, kể cả khi một bảng đã xong từ sớm.',
    },
  }),

  defineStep<TopoState, TopoEvent>({
    id: 'theo-dot',
    short: 'Theo đợt',
    tag: 'ỨNG DỤNG',
    tone: 'sun',
    title: 'Chạy song song theo đợt',
    Scene: WavesScene,
    build: () => WAVES,
    Body: () => (
      <>
        <p>
          Lấy cả đợt thay vì từng bảng: mọi bảng đang sẵn sàng chạy cùng lúc, xong cả đợt thì tính
          đợt sau. Số nhỏ ở góc là số thứ tự đợt của bảng đó.
        </p>
        <p>
          {TABLES.length} bảng cần {WAVE_COUNT} đợt. Thêm thread cũng không ít hơn được, vì đường
          dài nhất ({LONGEST_PATH.join(' → ')}) có {LONGEST_PATH.length} bảng nối nhau. Muốn
          pipeline xong sớm hơn thì phải rút ngắn đường đó.
        </p>
      </>
    ),
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          <code>dbt run --threads 4</code> chạy cùng lúc tối đa 4 model đã sẵn sàng; Airflow cũng
          xếp mọi task đã xong upstream vào hàng chờ chạy. Đường dài nhất gọi là{' '}
          <b>critical path</b>: nó quyết định pipeline chạy lâu ít nhất bao nhiêu.
        </>
      ),
    },
  }),

  defineStep<TopoState, TopoEvent>({
    id: 'vong',
    short: 'Có vòng',
    tag: 'BẪY',
    tone: 'rose',
    title: 'Khi DAG có vòng',
    Scene: CycleScene,
    build: () => CYCLE,
    Body: () => (
      <>
        <p>
          Ai đó thêm cột churn_score vào {CYCLE_EDGE.to}, lấy từ {CYCLE_EDGE.from}. Nhưng{' '}
          {CYCLE_EDGE.from} lại build từ {CYCLE_EDGE.to}: hai bảng chờ lẫn nhau, đồ thị không còn là
          DAG.
        </p>
        <p>
          Kahn phát hiện chuyện này rất rẻ: queue rỗng mà số bảng đã chạy vẫn ít hơn tổng số bảng.
          Không có thứ tự chạy nào hợp lệ; phải sửa model để bỏ vòng.
        </p>
      </>
    ),
    callout: {
      kind: 'de',
      title: 'TRONG DATA ENGINEERING',
      text: (
        <>
          dbt báo lỗi có vòng ngay lúc dựng DAG, trước khi chạy model nào; Airflow từ chối nạp DAG
          có vòng. Trong Python, <code>graphlib</code> báo <code>CycleError</code>.
        </>
      ),
    },
  }),

  defineStep<TopoState, TopoEvent>({
    id: 'dfs',
    short: 'Bằng DFS',
    tag: 'THAO TÁC',
    tone: 'lav',
    title: 'Cách thứ hai: DFS và thứ tự return',
    Scene: DfsScene,
    build: () => DFS,
    Body: ({ frames }) => {
      const { order } = frames.at(-1)!.state;
      return (
        <>
          <p>
            Gọi DFS từ từng bảng chưa thấy. Một bảng chỉ return khi mọi bảng phía sau nó đã return,
            nên bảng return trước phải chạy sau. Đảo ngược thứ tự return là ra thứ tự chạy.
          </p>
          <p>
            Kết quả: {order.join(', ')}. Khác với Kahn nhưng cũng hợp lệ: một DAG thường có nhiều
            thứ tự topo. Muốn DFS phát hiện vòng thì cần nhớ thêm bảng nào đang nằm trên call stack:
            gặp lại một bảng như vậy là có vòng.
          </p>
        </>
      );
    },
  }),

  defineStep<CodeTraceState, RowEvent>({
    id: 'tom-tat',
    short: 'Tóm tắt',
    tag: 'TÓM TẮT',
    tone: 'peach',
    title: 'graphlib làm sẵn cho bạn',
    Scene: RecapScene,
    build: () => RECAP,
    Body: () => (
      <>
        <p>
          Python có sẵn <code>graphlib.TopologicalSorter</code> (từ 3.9). Nó nhận ngược chiều mũi
          tên: mỗi bảng → các bảng nó phụ thuộc. <code>get_ready()</code> trả về cả đợt đang sẵn
          sàng, <code>done()</code> báo xong để mở khoá các bảng phía sau; bảng bên phải ghi lại
          từng đợt.
        </p>
        <p>
          Ba điều cần nhớ: thứ tự topo chỉ có trên DAG; Kahn đếm bậc vào và cho luôn các đợt chạy
          song song; có vòng thì Kahn kẹt lại, nên chỉ cần đếm số bảng đã chạy là phát hiện được.
        </p>
      </>
    ),
  }),
];

export const topologicalSortLesson: Lesson = {
  slug: 'topological-sort',
  steps,
  legend: [
    { swatch: 'ash', label: 'chưa chạy' },
    { swatch: 'peach', label: 'sẵn sàng, chờ quay lui' },
    { swatch: 'sun', label: 'đang chạy, trên vòng' },
    { swatch: 'mint', label: 'đã chạy' },
  ],
  objectives: [
    { text: 'Hiểu bậc vào và thứ tự topo', step: 0 },
    { text: 'Xếp thứ tự chạy bằng thuật toán Kahn', step: 1 },
    { text: 'Tìm các đợt chạy song song và critical path', step: 2 },
    { text: 'Phát hiện vòng trong DAG', step: 3 },
    { text: 'Xếp thứ tự bằng DFS', step: 4 },
  ],
  quiz: QUIZ,
};
