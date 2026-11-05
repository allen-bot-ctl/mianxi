import { DemoApp } from './app/DemoApp';

const canvas = document.getElementById('stage');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('找不到 #stage canvas。');
}

try {
  const app = new DemoApp(canvas);
  app.start();
  window.addEventListener('pagehide', () => app.destroy(), { once: true });
  // 方便在控制台查看状态；不暴露任何图像/关键点上传能力。
  (window as unknown as { __mianxiDemo?: DemoApp }).__mianxiDemo = app;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const box = document.createElement('div');
  box.className = 'fatal';
  box.textContent = `H5 demo 启动失败：${message}`;
  document.body.replaceChildren(box);
  throw error;
}
