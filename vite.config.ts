import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Сборка в один index.html: открывается двойным кликом и работает на GitHub Pages.
export default defineConfig({
  base: './',
  build: { outDir: 'docs', emptyOutDir: false }, // docs/index.html отдаёт GitHub Pages
  plugins: [viteSingleFile()],
  test: { include: ['tests/**/*.test.ts'] },
});
