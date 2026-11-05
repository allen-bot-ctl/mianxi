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

## 验证命令

```bash
npm test
npm run build
node game.js          # 无 tt 时自动进入无头 mock 探针，不崩
node -e "require('./dist/src/app.js').bootstrapMock()"  # 显式无头 mock
```

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
- S1–S9 只是状态机骨架，隐私告知、系统授权、校准、录屏、分享、结果页的完整交互尚未接入。
- 美术/音效未采购、未接入；HUD/扑扑为色块占位。
- `project.config.json` 的 appid 是 `touristappid`，发布前必须替换。
- 开发者工具不覆盖美颜/录屏，相关能力只能真机验收。
