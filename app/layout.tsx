import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { TopBar } from '@/src/components/TopBar';
import { OG_BASE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/src/site';
import '@/src/styles/tokens.css';
import './globals.css';

const mono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '700', '800'],
});

export const metadata: Metadata = {
  // Gốc để Next ghép thành link tuyệt đối cho ảnh Open Graph và các URL khác trong metadata.
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { ...OG_BASE, title: SITE_NAME, description: SITE_DESCRIPTION },
  // X (Twitter) dùng lại ảnh Open Graph, hiện khổ lớn.
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={mono.variable}>
      <body>
        <a href="#noi-dung" className="skip-link">
          Bỏ qua tới nội dung
        </a>
        <TopBar />
        {children}
        {/* Đếm lượt xem trang. Chỉ gắn khi build trên Vercel (biến VERCEL có sẵn ở đó): chạy trên
            máy hay trong CI thì không có script /_vercel/insights để tải. */}
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  );
}
