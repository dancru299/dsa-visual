import type { GraphLayout } from '@/src/scenes/GraphScene';
import type { Graph } from './algorithm';

// Lineage nhỏ kiểu một project dbt: bảng nguồn → staging → mart → dashboard.
export const LINEAGE: Graph = {
  raw_orders: ['stg_orders'],
  stg_orders: ['orders_snapshot', 'fct_orders'],
  raw_customers: ['stg_customers'],
  stg_customers: ['dim_customers'],
  dim_customers: ['fct_orders', 'churn_model'],
  fct_orders: ['revenue_dashboard'],
};

// Vị trí node đặt tay theo từng lớp, không dùng thuật toán tự bố cục.
// Cột cách nhau 170, node rộng 132 (mặc định của GraphScene), nên giữa hai cột có khe 38 để
// cạnh rẽ sang hàng khác.
const COL = [76, 246, 416, 586, 756];
const ROW = [45, 145, 245];

export const LINEAGE_LAYOUT: GraphLayout = {
  width: 832,
  height: 290,
  nodes: [
    { id: 'raw_orders', label: 'raw_orders', x: COL[0], y: ROW[0] },
    { id: 'raw_customers', label: 'raw_customers', x: COL[0], y: ROW[2] },
    { id: 'stg_orders', label: 'stg_orders', x: COL[1], y: ROW[0] },
    { id: 'stg_customers', label: 'stg_customers', x: COL[1], y: ROW[2] },
    { id: 'orders_snapshot', label: 'orders_snapshot', x: COL[2], y: ROW[0] },
    { id: 'dim_customers', label: 'dim_customers', x: COL[2], y: ROW[2] },
    { id: 'fct_orders', label: 'fct_orders', x: COL[3], y: ROW[1] },
    { id: 'churn_model', label: 'churn_model', x: COL[3], y: ROW[2] },
    { id: 'revenue_dashboard', label: 'revenue_dashboard', x: COL[4], y: ROW[1] },
  ],
  edges: Object.entries(LINEAGE).flatMap(([from, tos]) => tos.map((to) => ({ from, to }))),
};
