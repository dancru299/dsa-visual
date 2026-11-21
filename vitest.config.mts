import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Vite tự đọc alias `@/*` trong tsconfig.json, không cần plugin riêng.
  resolve: { tsconfigPaths: true },
  test: {
    // Thuật toán và trace là hàm thuần nên chạy trong Node là đủ.
    // Khi cần test component React, thêm jsdom cho riêng file đó.
    environment: 'node',
    // Chỉ lấy test trong src/, để Vitest không đụng vào file Playwright trong e2e/.
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
