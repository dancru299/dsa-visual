import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

// Ảnh xem trước khi chia sẻ link (Open Graph), vẽ lúc build bằng ImageResponse.
// Font JetBrains Mono (giấy phép OFL, kèm trong assets/fonts) gồm cả bảng chữ tiếng Việt.

export const OG_SIZE = { width: 1200, height: 630 };

const INK = '#211d2c';
const MUTED = '#5f5a6b';
const PAPER = '#f4efe4';
const SURFACE = '#fffcf6';
const SUN = '#f6d77b';
const MINT = '#bde3b1';

// Đọc font một lần rồi cache ('use cache'). Đọc file là I/O; không cache thì Next coi ảnh là động
// và vẽ lại mỗi lần có người xin, có cache thì ảnh được vẽ sẵn lúc build.
async function loadFonts() {
  'use cache';
  const dir = join(process.cwd(), 'assets', 'fonts');
  const files = await Promise.all([
    readFile(join(dir, 'jetbrains-mono-latin-400-normal.woff')),
    readFile(join(dir, 'jetbrains-mono-vietnamese-400-normal.woff')),
    readFile(join(dir, 'jetbrains-mono-latin-800-normal.woff')),
    readFile(join(dir, 'jetbrains-mono-vietnamese-800-normal.woff')),
  ]);
  // Trả về ArrayBuffer: kiểu mà cả 'use cache' lẫn ImageResponse đều nhận.
  return files.map((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
}

// Cắt câu dài cho vừa khung, cắt ở ranh giới từ.
const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, text.lastIndexOf(' ', max))}…`;

type Props = { kicker: string; title: string; summary: string; chips: string[] };

export async function ogImage({ kicker, title, summary, chips }: Props) {
  const [latin400, viet400, latin800, viet800] = await loadFonts();
  const name = 'JetBrains Mono';
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: PAPER,
        padding: 44,
        fontFamily: name,
        color: INK,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: SURFACE,
          border: `4px solid ${INK}`,
          borderRadius: 28,
          boxShadow: `12px 12px 0 ${INK}`,
          padding: '44px 56px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: 2,
              color: MUTED,
            }}
          >
            {kicker}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 22 ? 60 : 72,
              fontWeight: 800,
              lineHeight: 1.1,
            }}
          >
            {title}
          </div>
          <div style={{ display: 'flex', fontSize: 28, lineHeight: 1.45, color: MUTED }}>
            {clip(summary, 150)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {chips.map((c) => (
            <div
              key={c}
              style={{
                display: 'flex',
                fontSize: 24,
                fontWeight: 800,
                border: `3px solid ${INK}`,
                borderRadius: 999,
                padding: '6px 20px',
                background: SUN,
              }}
            >
              {c}
            </div>
          ))}
          <div
            style={{ display: 'flex', marginLeft: 'auto', fontSize: 32, fontWeight: 800, gap: 10 }}
          >
            <span>DSA</span>
            <span style={{ background: MINT, padding: '0 10px' }}>Visual</span>
          </div>
        </div>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name, data: latin400, weight: 400, style: 'normal' },
        { name, data: viet400, weight: 400, style: 'normal' },
        { name, data: latin800, weight: 800, style: 'normal' },
        { name, data: viet800, weight: 800, style: 'normal' },
      ],
    },
  );
}
