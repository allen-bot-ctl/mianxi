import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

const cwd = process.cwd();
const projectRoot = fs.existsSync(path.resolve(cwd, 'src'))
  ? cwd
  : path.resolve(cwd, '..');

export default defineConfig({
  root: path.resolve(projectRoot, 'demo'),
  // GitHub Pages 项目页部署在 /mianxi/ 下；本地开发保持相对路径。
  base: process.env.VITE_BASE || './',
  server: {
    host: true,
    port: 5173,
    fs: {
      // demo 需要 import 根目录 src/ 与 config/tunables.json。
      allow: [projectRoot],
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2019',
    sourcemap: true,
  },
});
