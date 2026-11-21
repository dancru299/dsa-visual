import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DSA Visual',
  description:
    'Học cấu trúc dữ liệu và giải thuật bằng animation, dành cho người học Data Engineering.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
