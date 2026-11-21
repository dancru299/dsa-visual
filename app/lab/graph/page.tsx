import type { Metadata } from 'next';
import { LineageLab } from '@/src/lab/lineage/LineageLab';

export const metadata: Metadata = {
  title: 'Thử nghiệm: scene đồ thị',
  robots: { index: false },
};

// Trang thử nghiệm của Phase 1, không nằm trong danh sách bài. Mục đích: kiểm tra engine trace
// chạy được với dữ liệu không phải mảng trước khi làm BFS, DFS, topological sort ở Phase 2.
export default function GraphLabPage() {
  return (
    <main style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 16px 48px' }}>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Bản thử nghiệm · Phase 1</p>
      <h1 style={{ margin: '4px 0 8px', fontSize: 26 }}>Scene đồ thị: BFS trên lineage</h1>
      <p style={{ margin: '0 0 16px', maxWidth: '70ch' }}>
        Trang này thử engine trace với dữ liệu là đồ thị thay vì mảng. Nó chưa phải một bài học; bài
        BFS và DFS đầy đủ sẽ làm ở Phase 2.
      </p>
      <LineageLab />
    </main>
  );
}
