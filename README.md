# 面戏 · 抖音小游戏脚手架

首发玩法「吼退扑扑」的第一个可交付切片：TypeScript + Canvas 2D 的模块边界、可单测内核、隐藏真机探针骨架。完整玩法、美术与音效仍为占位。

唯一规格：`notes/coding-handoff.md`。本切片严格按该文档实现，未改 `notes/`、`artifacts/`。

## 快速开始

```bash
npm install
npm test        # vitest，全部纯逻辑，不依赖摄像头
npm run build   # tsc → dist/
npm run watch   # 监听编译
```

- 所有可调数值在 **`config/tunables.json`**（根目录）。业务逻辑不内置这些阈值。
- 编译产物为 CommonJS + source map，输出到 `dist/`，路径与 TS 源对应。
- 根入口 `game.js` 是薄封装：

  ```js
  require('./dist/src/app.js').bootstrap();
  ```

  发布时把 `game.js`、`game.json`、`project.config.json`、`dist/` 一起放进发布目录。`dist/` 已被 `.gitignore` 忽略，提交前/发布会先 `npm run build`。

## 用抖音开发者工具打开

1. 打开抖音开发者工具，选择「小游戏」→ 导入项目，目录选仓库根 `/workspace/projects/mian-xi`。
2. `project.config.json` 里 appid 目前是占位 `touristappid`，换成自己的小游戏 appid；工程类型为 `game`。
3. 先执行 `npm run build`，再在工具里编译运行。
4. 开发者工具的相机、美颜、录屏能力不完整；美颜与录屏必须在真机测。
5. 竖屏由 `game.json` 的 `deviceOrientation: portrait` 锁定。

### 隐藏探针入口

在启动参数里带 `probe=1`，例如分享路径/调试链接追加 `?probe=1`，或真机启动参数中加入：

```
probe=1
```

入口读取 `tt.getLaunchOptionsSync().query.probe === '1'`，直接切到探针场景。普通启动会先进入 S1–S9 占位场景（点击推进）。

探针场景结构对应交接 §12：

- 相机画面通过 `ctx.drawImage(video, …)` 画到上屏 canvas（同一 `ViewTransform` 处理 cover + 镜像 + 关键点坐标）。
- 每 N 帧调用一次 `detectFaces`，N 可在 1/3/5 间切换。
- 显示 mouth 20 点编号、`r_raw`、`o`、`detect Hz`、检测耗时、分数、yaw/pitch/roll、脸框。
- 美颜三档切换：自然 `(0.3,0.4,0,0)` / 最低 `(0,0,0,0)` / 探针用 `(1,1,1,1)`。
- 「导出日志」把纯数值 JSON 写到本地存储，并尝试写入剪贴板；**不含图像、视频或关键点序列**。
- 无 `tt`/无相机时用 `MockCameraSource` + `MockFaceSource` 跑通场景、HUD 和数值日志，但画面明确标注 `MOCK — no camera image`，不假装真实相机画面。`bootstrap()` 在没有 `tt` 时会自动走无头 mock；也可直接调用：

  ```js
  require('./dist/src/app.js').bootstrapMock();
  ```

## 目录

```
src/
  platform/douyin/   CameraSource FaceSource Recorder Share Storage Auth（tt 守卫，无 tt 加载不崩）
  platform/mock/     假相机、假 FaceFrame 序列、内存存储、无头 canvas
  core/signal/       transform / mouthOpenness / calibration / faceValidity
  core/intent/       IntentEngine（§5 状态机，纯逻辑）
  game/houtui/       schedule（§3.3）/ judge（§3.4）/ HoutuiMode 最小实现
  game/GameMode.ts   §11.2 预留玩法接口
  render/            compositor + sprite/tween 占位
  flow/              S1–S9 占位场景 + ProbeScene
  telemetry/         §13 事件名 + 内存缓冲
  config/            tunables 的类型访问层
  debug/             20 点编号、o/detectHz、触发源切换
  types/             FaceFrame 等
config/tunables.json 所有可调数值（根目录）
tests/               内核单测
```

## 本轮已实现

- `mouthOpenness`：仅用嘴部 20 点包围盒高/宽，个人 `base/peak` 归一化，截断 `[0,1.5]`；未实现 MAR，未移植任何开源点号。
- `faceValidity`：score、脸宽比、yaw/pitch 边界全部读配置。
- `IntentEngine`：WAIT_CLOSED → APPROACH → CANDIDATE → ROAR，掉回、LATE、PAUSED、RESUME、ABORT、锁定。
- `judge`：四档 p 窗口 + 3 号假冲 p≤0.66 判太早；称号文案只在配置里。
- `schedule`：三只扑扑节奏、固定种子随机停顿、慢速 1.3 倍。
- `HoutuiMode`：Intent 事件 + 当前 schedule 的 p → judge → 本轮结果枚举；美术为色块占位。
- Probe/HUD/日志、mock 路径。

## 边界与后续

- S1–S9 目前是骨架占位，只负责证明场景状态机可切换；隐私、授权、校准、录屏、分享的完整流程在下一轮接入。
- 真机探针结论回来后，优先确认：录屏是否包含画面/游戏层/音效、`VIDEO_PREMIRRORED` 真值、pitch/yaw 单位、美颜全 0 时检测是否可用、`onMouthAh` 灵敏度、检测频率与耗时。
- 不接 GitHub、不加 remote、不 commit/push。无任何上传人脸/图像/关键点的网络代码。
