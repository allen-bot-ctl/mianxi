# STATUS · 面戏第一个可交付切片

日期：2026-11-06
工作目录：`/workspace/projects/mian-xi`
依据：`notes/coding-handoff.md`（未修改 notes/artifacts/手册）
Git：按要求**未 commit、未 push、未加 remote**。

## 做了什么

### 工程
- `npm install && npm test`：8 个测试文件、35 个用例全绿。
- `npm run build`：`tsc -p tsconfig.build.json` 成功，产物在 `dist/`，根 `game.js` require `dist/src/app.js`。
- `game.json` 竖屏；`project.config.json` 为小游戏工程占位（appid `touristappid`）。
- 所有可调数值集中在根目录 **`config/tunables.json`**；`src/config/index.ts` 只做类型访问。
- 已确认无 Cocos、MediaPipe、TensorFlow.js、@vladmandic/human、Jeeliz、face-api；无 `video.paintTo`；无 MAR 实现。
- 没有实现任何上传图像/视频/关键点的网络逻辑。

### 内核
- `core/signal/transform`：唯一的 cover + 镜像 + 缩放变换，画面与关键点共用。
- `core/signal/mouthOpenness`：20 点包围盒 `r_raw`，`(r_raw-base)/(peak-base)` 截断 `[0,1.5]`。
- `core/signal/faceValidity`：score / 脸宽比 / yaw / pitch 边界。
- `core/signal/calibration`：base 中位数、peak 第 90 百分位、`peak-base ≥ 0.15` 校验。
- `core/intent/IntentEngine`：§5.2 状态机，覆盖 WAIT_CLOSED→APPROACH→CANDIDATE→ROAR、候选掉回、LATE、PAUSED/RESUME、ABORT、锁定。
- `game/houtui/schedule`：三只扑扑节奏（直冲 ease-in quad、停顿、假冲）、固定种子随机停顿、慢速 1.3 倍。
- `game/houtui/judge`：p 四档窗口；3 号假冲 `p≤0.66` 判太早；称号文案只读配置。
- `game/houtui/HoutuiMode`：Intent 事件 + 当前 p → judge → 每只结果枚举；状态/特效为最小占位。

### 平台与探针
- `platform/douyin`：Camera / Face / Recorder / Share / Storage / Auth 骨架；所有 `tt` 访问有守卫，无 `tt` 时模块加载不崩。
- `platform/mock`：假相机、假 FaceFrame 序列、内存存储、无头 canvas。
- `flow/ProbeScene`：相机 drawImage 上屏；每 N 帧 detectFaces；20 点编号；r_raw/o/detectHz/耗时；美颜三档；N=1/3/5；纯数值日志落本地存储 + 尝试剪贴板。无 tt/无相机时明确显示 `MOCK — no camera image`，不伪造相机画面。
- `flow`：S1–S9 场景枚举与可点击切换骨架；启动参数 `probe=1` 直达探针。

### H5 demo（本轮新增）

- 新增 `demo/`：Vite + TypeScript + Canvas 2D 的浏览器壳，无 DOM UI 覆盖层；支持鼠标、触摸和键盘。
- 完整主路径：S1 首页 → S2 隐私 → S3 摄像头/对脸 → S4 真校准 → S3 0.5s → S5 倒计时/开录 → S6 三只扑扑 → S7 2.5s 片尾 → S8 结果/下载/重玩 → S9 设置。
- 复用根实现：`core/signal`（`measureMouth` / `computeCalibration` / `evaluateFaceValidity` / `ViewTransform`）、`core/intent`、`game/houtui`（schedule / judge / `HoutuiMode`）、根配置与遥测事件名。demo 不复制玩法算法。
- `demo/platform/DemoFaceSource`：输出标准 `FaceFrame`，中央可拖动假 bbox（宽约画布 45%），几何合成合法 20 点上/下唇 mouth，标签 `demo-synth`；原生 `FaceDetector` 若存在只更新 bbox。
- `demo/platform/DemoCameraSource`：`getUserMedia` + `<video>`，封面/镜像仍走根 `ViewTransform`；拒绝授权显示「没有摄像头授权就玩不了哦」及重试/返回首页；`?demoMock=1` 或错误页按钮可切到明确标注的占位画面。
- `demo/platform/DemoRecorder`：`MediaRecorder` + `canvas.captureStream()`，失败不阻塞流程，结果页提示「本浏览器未录上」并保留重玩。
- `demo/platform/DemoShare`：blob 通过 `<a download>` 下载；话题/标题只读展示，不伪造发布成功。
- `demo/platform/DemoStorage`：localStorage 只存隐私同意、校准、美颜档位、最高分。
- 设置页：美颜占位、重新校准、再看隐私说明、撤回授权并释放摄像头。
- 调试输入：点击/空格 = 吼；按住 ↑/W/鼠标 = 张嘴；拖动 = 挪假脸。S6 HUD 显示 `state / p / o / source=demo-synth / detectHz`。
- 为 demo 增加的根代码仅为只读 getter：`FlowController.scene`、`HoutuiMode` 的状态/进度/结果动画等；未改 `game.js`、`platform/douyin` 或玩法判定。
- 构建配置：`demo/vite.config.ts`；`demo/dist/`、`demo/.vite/` 已加入 `.gitignore`；新增 `demo`、`demo:build`、`demo:preview`、`demo:typecheck` 脚本和 `vite` devDependency。

## 验证命令

```bash
npm test
npm run build
npm run demo:typecheck
npm run demo:build

node game.js          # 无 tt 时自动进入无头 mock 探针，不崩
node -e "require('./dist/src/app.js').bootstrapMock()"  # 显式无头 mock
```

H5 demo 本地启动：

```bash
npm run demo          # http://localhost:5173/
```

本轮额外用无头 Chrome + fake media 实际走通 S1→S8：校准写入 `{base:0.1, peak:0.6}`，三只结果为 `perfect / perfect / too_early`，总分 `4 / 6`、称号「一嗓镇场」，第 3 只假动作在 `p≈0.61` 点击判 `too_early`，MediaRecorder 产出约 3.1MB blob 并可下载；另用拒绝摄像头权限的 Chrome 验证 S3 显示授权提示和「重试授权 / 使用占位画面 / 返回首页」。

## 下一步（真机探针）

1. 用真实 appid 在抖音开发者工具编译，装到至少 6 台真机，按交接 §12 跑 `probe=1`。
2. 优先记录并交回策划：
   - 录屏 10s 是否包含真人画面、游戏层、游戏音频；
   - `VIDEO_PREMIRRORED` 真值（画面与 20 点是否对齐）；
   - pitch/yaw 单位；
   - 闭嘴/说话/大笑/张大嘴各 10s 的 `r_raw`；
   - N=1/3/5 的检测 Hz、单次耗时；
   - 美颜 `(0.3,0.4,0,0)` / `(0,0,0,0)` / `(1,1,1,1)` 对比，尤其全 0 时检测是否可用；
   - `onMouthAh` 与自算 `o` 的对比。
3. 探针日志（纯数字）导出后，由策划改 `config/tunables.json` 的初值与注释里标注的占位项。

## 已知待确认 / 本轮刻意留空

- 抖音 API 细节仍需真机确认：`Camera.start` 返回结构、录屏参数/水印、`saveVideoToPhotosAlbum` 参数名、分享锚点 `query` 透传。平台层已做兼容与守卫，未假装已验证。
- `calibration.defaultBase=0.10`、`defaultPeak=0.60` 是占位，不是算法结论；等 §12 探针数据后由策划写入。
- `LATENCY_COMP_MS` 当前为 0。`IntentEngine` 支持 `pAt(t)` 回查，但 `HoutuiMode` 本轮用当前 p；若探针后该值非 0，需要给 GameMode 增加 p 时间序列。
- 抖音端 S1–S9 只是状态机骨架，隐私告知、系统授权、校准、录屏、分享、结果页的完整交互尚未接入；完整 H5 交互在独立 `demo/` 壳中，未合入 `game.js`。
- 美术/音效未采购、未接入；HUD/扑扑为色块占位。
- `project.config.json` 的 appid 是 `touristappid`，发布前必须替换。
- 开发者工具不覆盖美颜/录屏，相关能力只能真机验收。
- H5 demo 的假脸/合成嘴只用于打通主路径，不代表真实检测精度；未验证真机相机方向、镜像和编码格式。
- H5 demo 不支持抖音发布器、平台美颜或相册保存；「发布话题 / 视频标题」只是只读文案，下载成片不等同发布。
- 摄像头在非 https/非 localhost 的局域网 IP 下会被浏览器拒绝，需要 https 或使用 `?demoMock=1` 占位画面。
