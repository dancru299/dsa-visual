import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { TopBar } from '@/src/components/TopBar';
import '@/src/styles/tokens.css';
import './globals.css';

const mono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '700', '800'],
});

export const metadata: Metadata = {
  title: { default: 'DSA Visual', template: '%s · DSA Visual' },
  description:
    'Học cấu trúc dữ liệu và giải thuật bằng animation, dành cho người học Data Engineering.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={mono.variable}>
      <body>
        <TopBar />
        {children}
      </body>
    </html>
  );
}
