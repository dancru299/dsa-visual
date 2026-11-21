'use client';

import { useId } from 'react';
import { CodeView } from '@/src/components/CodeView';
import type { SceneComponent, SceneProps } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import styles from './GraphScene.module.css';

// Scene đồ thị dùng chung cho các bài duyệt đồ thị (BFS, DFS, topological sort).
// Bố cục (vị trí node) là phần trình bày nên truyền qua factory, không nằm trong mỗi snapshot;
// state chỉ chứa phần thay đổi theo thời gian.

export type GraphLayout = {
  width: number;
  height: number;
  nodes: { id: string; label: string; x: number; y: number }[]; // x, y là tâm của node
  // path: tự vẽ cạnh khi cách nối mặc định không hợp, ví dụ cạnh đi ngược chiều tạo thành vòng.
  edges: { from: string; to: string; path?: string }[];
  flow?: 'right' | 'down'; // cạnh đi từ trái sang phải (mặc định) hay từ trên xuống
  nodeWidth?: number;
  nodeHeight?: number;
  bend?: number; // khoảng sau node nguồn để cạnh rẽ sang hàng (cột) khác; nhỏ hơn khe giữa hai lớp
};

export type GraphSceneState = {
  marks: Record<string, 'idle' | 'frontier' | 'current' | 'done'>;
  activeEdge: string | null; // "a->b"
  treeEdges: string[];
  pending: string[]; // queue (BFS) hoặc stack (DFS)
  order: string[]; // thứ tự đã lấy ra xử lý; có thể lặp lại một node
  badges?: Record<string, number>; // số nhỏ ở góc node, ví dụ số bước từ nguồn
};

type Options = {
  layout: GraphLayout;
  narrow?: GraphLayout; // bố cục dọc cho khung hẹp; không có thì kéo ngang
  // Khung hẹp hơn mức này thì dùng bố cục dọc. Bố cục ngang càng rộng thì càng phải đổi sớm,
  // để chữ không bị thu nhỏ quá 80%.
  narrowBelow?: 480 | 720;
  pendingTitle: string; // ví dụ "QUEUE (ĐẦU BÊN TRÁI)"
  orderTitle: string;
  code?: { file: string; lines: readonly string[] };
};

const key = (from: string, to: string) => `${from}->${to}`;

function GraphSvg({
  layout,
  state,
  className,
}: {
  layout: GraphLayout;
  state: GraphSceneState;
  className?: string;
}) {
  const { marks, activeEdge, treeEdges, order, badges } = state;
  const { nodeWidth = 132, nodeHeight = 34, bend = 30, flow = 'right' } = layout;
  const pos = new Map(layout.nodes.map((n) => [n.id, n]));
  const hw = nodeWidth / 2;
  const hh = nodeHeight / 2;
  // id của marker mũi tên phải duy nhất trên trang; bỏ ký tự đặc biệt để dùng được trong url(#...).
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const arrowIdle = `${id}-arrow-idle`;
  const arrowDark = `${id}-arrow-dark`;

  // Cạnh đi từ mép node nguồn sang mép node đích. Nếu khác hàng (khác cột khi đi xuống), cạnh
  // rẽ ngay trong khe sau node nguồn rồi mới chạy thẳng, để không chui dưới node ở giữa và
  // trông như đi ra từ node đó.
  const edgePath = (from: string, to: string) => {
    const a = pos.get(from)!;
    const b = pos.get(to)!;
    if (flow === 'down') {
      const y1 = a.y + hh;
      const y2 = b.y - hh - 6; // chừa chỗ cho đầu mũi tên
      if (a.x === b.x) return `M${a.x},${y1} L${b.x},${y2}`;
      const yb = Math.min(y1 + bend, y2);
      const ym = (y1 + yb) / 2;
      return `M${a.x},${y1} C${a.x},${ym} ${b.x},${ym} ${b.x},${yb} L${b.x},${y2}`;
    }
    const x1 = a.x + hw;
    const x2 = b.x - hw - 6;
    if (a.y === b.y) return `M${x1},${a.y} L${x2},${b.y}`;
    const xb = Math.min(x1 + bend, x2);
    const xm = (x1 + xb) / 2;
    return `M${x1},${a.y} C${xm},${a.y} ${xm},${b.y} ${xb},${b.y} L${x2},${b.y}`;
  };

  return (
    <svg
      className={cx(styles.svg, className)}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label={`Đồ thị ${layout.nodes.length} node. Đã xử lý: ${order.join(', ') || 'chưa có'}.`}
    >
      <defs>
        {[
          [arrowIdle, 'var(--ash-s)'],
          [arrowDark, 'var(--ink)'],
        ].map(([markerId, color]) => (
          <marker
            key={markerId}
            id={markerId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerUnits="userSpaceOnUse"
            markerWidth="10"
            markerHeight="10"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" style={{ fill: color }} />
          </marker>
        ))}
      </defs>

      {layout.edges.map(({ from, to, path }) => {
        const k = key(from, to);
        const isActive = activeEdge === k;
        const isTree = treeEdges.includes(k);
        return (
          <path
            key={k}
            d={path ?? edgePath(from, to)}
            className={cx(styles.edge, isTree && styles.tree, isActive && styles.active)}
            markerEnd={`url(#${isTree || isActive ? arrowDark : arrowIdle})`}
          />
        );
      })}

      {layout.nodes.map((n) => {
        const mark = marks[n.id] ?? 'idle';
        const badge = badges?.[n.id];
        return (
          <g key={n.id} className={cx(mark !== 'idle' && styles[mark])} data-mark={mark}>
            <rect
              className={styles.shadow}
              x={n.x - hw + 3}
              y={n.y - hh + 3}
              width={nodeWidth}
              height={nodeHeight}
              rx={9}
            />
            <rect
              className={styles.box}
              x={n.x - hw}
              y={n.y - hh}
              width={nodeWidth}
              height={nodeHeight}
              rx={9}
            />
            <text
              className={styles.label}
              x={n.x}
              y={n.y}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {n.label}
            </text>
            {badge !== undefined && (
              <g className={styles.badge}>
                <circle cx={n.x + hw - 3} cy={n.y - hh} r={9} />
                <text x={n.x + hw - 3} y={n.y - hh} textAnchor="middle" dominantBaseline="central">
                  {badge}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function graphScene({
  layout,
  narrow,
  narrowBelow = 480,
  pendingTitle,
  orderTitle,
  code,
}: Options): SceneComponent<GraphSceneState> {
  function GraphScene({ frame, animate }: SceneProps<GraphSceneState>) {
    const { pending, order } = frame.state;
    return (
      <div className={cx(styles.root, !animate && styles.noAnim)} data-testid="graph-scene">
        {narrow ? (
          // Vẽ cả hai bố cục, CSS container query chọn cái hợp với bề ngang khung. Không đo bằng
          // JavaScript nên HTML từ server và lần render đầu trên trình duyệt luôn giống nhau.
          <>
            <GraphSvg
              layout={layout}
              state={frame.state}
              className={narrowBelow === 720 ? styles.wideOnlyLg : styles.wideOnly}
            />
            <GraphSvg
              layout={narrow}
              state={frame.state}
              className={narrowBelow === 720 ? styles.narrowOnlyLg : styles.narrowOnly}
            />
          </>
        ) : (
          <div
            className={styles.scroll}
            tabIndex={0}
            role="region"
            aria-label="Đồ thị, cuộn ngang được trên màn hình hẹp"
          >
            <GraphSvg layout={layout} state={frame.state} className={styles.minWide} />
          </div>
        )}

        {frame.say && (
          <div
            key={frame.say}
            className={cx(styles.say, frame.sayTone && styles[frame.sayTone])}
            role="status"
          >
            {frame.say}
          </div>
        )}

        <div className={styles.side}>
          <div className={styles.card}>
            <div className={styles.head}>{pendingTitle}</div>
            <div className={styles.chips}>
              {pending.map((p, i) => (
                <span key={`${p}-${i}`} className={styles.chip}>
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.head}>{orderTitle}</div>
            <div className={styles.chips}>
              {order.map((p, i) => (
                <span key={`${p}-${i}`} className={cx(styles.chip, styles.visited)}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        {code && <CodeView file={code.file} lines={code.lines} highlight={frame.codeLines} />}
      </div>
    );
  }
  return GraphScene;
}
