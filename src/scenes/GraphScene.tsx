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
  edges: { from: string; to: string }[];
};

export type GraphSceneState = {
  marks: Record<string, 'idle' | 'frontier' | 'current' | 'done'>;
  activeEdge: string | null; // "a->b"
  treeEdges: string[];
  pending: string[]; // queue (BFS) hoặc stack (DFS)
  order: string[]; // thứ tự đã lấy ra xử lý
};

type Options = {
  layout: GraphLayout;
  pendingTitle: string; // ví dụ "QUEUE (ĐẦU BÊN TRÁI)"
  orderTitle: string;
  code?: { file: string; lines: readonly string[] };
  nodeWidth?: number;
  nodeHeight?: number;
  bend?: number; // khoảng ngang sau node nguồn để cạnh rẽ sang hàng khác; nhỏ hơn khe giữa hai cột
};

const key = (from: string, to: string) => `${from}->${to}`;

export function graphScene({
  layout,
  pendingTitle,
  orderTitle,
  code,
  nodeWidth = 132,
  nodeHeight = 34,
  bend = 30,
}: Options): SceneComponent<GraphSceneState> {
  const pos = new Map(layout.nodes.map((n) => [n.id, n]));
  const hw = nodeWidth / 2;
  const hh = nodeHeight / 2;

  // Cạnh đi từ mép phải node nguồn sang mép trái node đích. Nếu khác hàng, cạnh rẽ lên hoặc
  // xuống ngay trong khe sau node nguồn rồi mới chạy ngang, để không chui dưới node ở cột giữa
  // và trông như đi ra từ node đó.
  const edgePath = (from: string, to: string) => {
    const a = pos.get(from)!;
    const b = pos.get(to)!;
    const x1 = a.x + hw;
    const x2 = b.x - hw - 6; // chừa chỗ cho đầu mũi tên
    if (a.y === b.y) return `M${x1},${a.y} L${x2},${b.y}`;
    const xb = Math.min(x1 + bend, x2);
    const xm = (x1 + xb) / 2;
    return `M${x1},${a.y} C${xm},${a.y} ${xm},${b.y} ${xb},${b.y} L${x2},${b.y}`;
  };

  function GraphScene({ frame, animate }: SceneProps<GraphSceneState>) {
    const { marks, activeEdge, treeEdges, pending, order } = frame.state;
    // id của marker mũi tên phải duy nhất trên trang; bỏ ký tự đặc biệt để dùng được trong url(#...).
    const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const arrowIdle = `${id}-arrow-idle`;
    const arrowDark = `${id}-arrow-dark`;

    return (
      <div className={cx(styles.root, !animate && styles.noAnim)} data-testid="graph-scene">
        <div className={styles.scroll}>
          <svg
            className={styles.svg}
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
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L10,5 L0,10 z" style={{ fill: color }} />
                </marker>
              ))}
            </defs>

            {layout.edges.map(({ from, to }) => {
              const k = key(from, to);
              const isActive = activeEdge === k;
              const isTree = treeEdges.includes(k);
              return (
                <path
                  key={k}
                  d={edgePath(from, to)}
                  className={cx(styles.edge, isTree && styles.tree, isActive && styles.active)}
                  markerEnd={`url(#${isTree || isActive ? arrowDark : arrowIdle})`}
                />
              );
            })}

            {layout.nodes.map((n) => {
              const mark = marks[n.id] ?? 'idle';
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
                </g>
              );
            })}
          </svg>
        </div>

        {frame.say && (
          <div
            key={frame.say}
            className={cx(styles.say, frame.sayTone === 'good' && styles.good)}
            role="status"
          >
            {frame.say}
          </div>
        )}

        <div className={styles.side}>
          <div className={styles.card}>
            <div className={styles.head}>{pendingTitle}</div>
            <div className={styles.chips}>
              {pending.map((p) => (
                <span key={p} className={styles.chip}>
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.head}>{orderTitle}</div>
            <div className={styles.chips}>
              {order.map((p) => (
                <span key={p} className={cx(styles.chip, styles.visited)}>
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
