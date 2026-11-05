# 面戏 · 吼退扑扑 · H5 demo

这是「吼退扑扑」的可交互浏览器切片，用来在没有抖音环境、没有真人 20 点检测器的情况下，完整走一遍
S1 → S9 主路径：

- 首页与隐私告知
- 摄像头授权 / 对脸检查
- 真实校准（`computeCalibration`）
- 倒计时、录屏
- 三只扑扑的真实 schedule / `IntentEngine` / `judge` / `HoutuiMode`
- 片尾卡、结果页、下载成片、再来一局
- 设置页：美颜档位占位、重新校准、隐私说明、撤回摄像头授权

它不是抖音小游戏发布包，也不接抖音、微信或任何上传服务。

## 启动

```bash
npm install
npm run demo        # Vite dev server，默认 http://localhost:5173/
npm run demo:build  # 生产构建到 demo/dist/
npm run demo:preview
```

`npm run demo` 会同时把仓库根目录的 `src/`、`config/tunables.json` 暴露给 Vite，因此不需要复制
业务代码。`demo/dist/` 已在 `.gitignore` 中忽略。

### 摄像头与 https

浏览器只允许在 **https** 或 **localhost / 127.0.0.1** 下调用 `getUserMedia`。

- 本机开发直接用 `http://localhost:5173/` 即可。
- 用手机通过局域网 IP 打开 `http://192.168.x.x:5173/` 时，多数浏览器会拒绝摄像头。
  需要 https 隧道、反向代理证书，或使用下面的占位画面。
- 拒绝授权后，S3 会显示「没有摄像头授权就玩不了哦。请允许摄像头后重试。」，并提供
  「重试授权 / 使用占位画面（仅 demo） / 返回首页」。
- 也可以直接在 URL 后加 `?demoMock=1`，从第一次请求就使用占位画面。

占位画面会明确标注「DEMO 占位画面 / 不是真实摄像头」，不会伪装成真实相机。

## 操作

| 操作 | 作用 |
| --- | --- |
| 点击按钮 | 推进场景 / 确认 |
| 点击画面或按空格 | 注入一次约 220ms 的「吼」脉冲 |
| 按住 ↑ / W | 持续张嘴（合成 `o` 升高） |
| 按住鼠标拖动 | 移动假脸框中心 |
| 在 S3 / S6 拖动 | 把假脸挪进/挪出对脸框，验证 validity 与暂停 |

音频不是必需：demo 用合成嘴输入驱动 `IntentEngine`，所以没有麦克风也能玩。

## 主路径与调试 HUD

- **S1 首页**：开始、设置；`?from=video&s=4` 会显示「TA 拿了 4 分，你来」。
- **S2 隐私**：同意后才会进 S3；「暂不」回首页。
- **S3 对脸检查**：调用 `getUserMedia`，用根目录 `evaluateFaceValidity` 检查假脸框；
  保持约 0.5s 进 S4。校准过的人会直接去 S5。
- **S4 校准**：先用 1s 闭嘴窗口采 base，再按住 1.5s 张嘴窗口采 peak；
  用根目录 `computeCalibration` 计算并写入 localStorage。
- **S5 倒计时**：MediaRecorder 从 `canvas.captureStream()` 开始录制，3 秒后进 S6。
- **S6 游戏**：三只扑扑由根目录 `schedule`、`IntentEngine`、`judge`、`HoutuiMode` 驱动。
  点击时机过晚会 `too_late`，第 3 只假动作在 `p≤0.66` 时点击会 `too_early`。
- **S7 片尾卡**：2.5s，停止录制，进入 S8。
- **S8 结果**：分数、称号、每只结果、本地最高分、只读话题/标题、下载成片、再来一局。
- **S9 设置**：美颜档位仅存档位；重新校准；再看隐私说明；撤回授权并清空同意标志、释放摄像头。

S6 左上角 HUD 会显示：

```text
source=demo-synth
state=APPROACH
p=0.42 o=0.31
face=1 mouth=20
detect=30.0Hz
```

其中 `state` 来自根 `IntentEngine`，`p` 来自当前 schedule，`o` 来自根 `mouthOpenness`。

## demo 的假脸与输入边界

H5 没有人脸 20 点检测器，而且本切片禁止引入 MediaPipe / TensorFlow.js / Human / Jeeliz /
face-api / Cocos / MAR / `paintTo`。

`demo/platform/DemoFaceSource.ts` 的做法：

- 输出标准 `FaceFrame`，`source` 语义为 `demo-synth`。
- 默认在画布中央生成可拖动的假 bbox，宽约画布 45%。
- 用 bbox 几何生成合法的 20 点嘴部：闭嘴时上下唇贴近，张嘴时上下唇分开。
- `raw` 范围从 `config.calibration.defaultBase/defaultPeak/minDelta` 推导，没有新增业务阈值。
- 如果浏览器恰好支持原生 Shape Detection API `FaceDetector`，只用它更新 bbox 中心/大小；
  mouth 仍然几何合成。没有该 API 时完全使用手动 bbox。
- 根目录的 `measureMouth` / `evaluateFaceValidity` / `IntentEngine` / `judge` / `HoutuiMode`
  仍然照常运行，demo 不复制这些算法。

平台适配只放在 `demo/platform/`：

- `DemoCameraSource`：`getUserMedia` → `<video>`；封面/镜像仍由根 `ViewTransform` 处理。
- `DemoFaceSource`：上述假脸源。
- `DemoRecorder`：`MediaRecorder` + `canvas.captureStream()`。
- `DemoShare`：把 blob 通过 `<a download>` 下载；话题和标题只读展示。
- `DemoStorage`：`localStorage` 适配。

demo 没有改 `game.js`，也没有把任何 demo 依赖塞进 `platform/douyin`、`src/` 的运行时逻辑。
对根代码只增加了只读 getter（`FlowController.scene`、`HoutuiMode` 的 HUD 状态），不改变玩法行为。

## 录屏失败

如果浏览器不支持 MediaRecorder / `canvas.captureStream()`，或录屏没有产生数据：

- 游戏流程照常继续，不会卡在 S5/S7。
- 结果页显示「本浏览器未录上：…」，并保留「再来一局」和「返回首页」。
- 没有可下载的 blob 时不显示「下载成片」。

Chrome / Edge 通常生成 WebM；Safari 的编解码支持取决于系统版本，未做跨浏览器承诺。

## 数据与隐私

- 摄像头画面只在本地 `<video>` / canvas / MediaRecorder 中处理。
- 不上传图像、视频或关键点；没有任何网络识别请求。
- localStorage 只写：隐私同意标志、校准 `{base, peak}`、美颜档位、本地最高分。
- 结果页的「发布话题」和「视频标题」只是 `config/tunables.json` 里的只读文案，
  下载不会自动发布到任何平台。

## 已知限制

- 不是抖音小游戏：没有 `tt`、没有平台美颜、没有相册保存、没有分享发布器。
- 假脸和合成嘴只用于打通主路径，不代表真实检测精度。
- 真机上的相机方向、镜像、录屏水印、编码格式仍需在目标浏览器/真机验证。
- 美术、音效、动效均为占位；数值全部来自根 `config/tunables.json`。
