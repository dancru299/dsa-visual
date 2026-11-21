import Link from 'next/link';
import { buttonClass } from '@/src/components/Button';

export default function NotFound() {
  return (
    <main
      id="noi-dung"
      tabIndex={-1}
      style={{ maxWidth: 640, margin: '0 auto', padding: '72px 16px' }}
    >
      <h1 style={{ fontSize: 32, margin: '0 0 12px' }}>Không tìm thấy trang</h1>
      <p style={{ margin: '0 0 24px', color: 'var(--muted)' }}>
        Bài này có thể chưa được làm, hoặc đường dẫn bị gõ sai.
      </p>
      <Link href="/" className={buttonClass('primary')}>
        Về trang chủ
      </Link>
    </main>
  );
}
