# 被讨厌的勇气 · 旁观世界

灵感来自 [Andrej Karpathy 的 LoTR Three.js 实验](https://x.com/karpathy/status/2083749667410727319)：用程序化 3D 场景，让你以**旁观者**身份走进一段故事。

**长期目标：** 将整本《被讨厌的勇气》（五夜对话）做成可旁观、可交互的 3D 世界，**按 Part 分块制作**，人物/场景模型全章一致。

**Playable:** Full **P00–P10** (prologue + five nights + snow ending). Dialogue adapted from Adlerian structure (not a verbatim book edition). **Default UI/dialogue/TTS language: English**, with **EN / 中文** toggle (`L`).

**当前可玩：** 全书 P00–P10。**默认英文**（界面、对白、配音），可切换中文。

## Live (GitHub Pages)

- **Site:** https://wsk-builds.github.io/courage-to-be-disliked-3d/
- **Repo:** https://github.com/wsk-builds/courage-to-be-disliked-3d

Static site, no build step. Push to `main` → Pages updates in ~1–2 minutes.

### Language

| | |
|--|--|
| Default | **English** |
| Switch | Top-right **EN / 中文**, or key **`L`** |
| Voices | System TTS; cast panel picks different English personas (philosopher / youth / narrator) |

### 文档

| 文档 | 内容 |
|------|------|
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | 全书划分、制作顺序、工程约定 |
| [docs/ORIGINAL_CHECKLIST.md](docs/ORIGINAL_CHECKLIST.md) | 原著五夜必呈清单（改稿对照） |
| [docs/CONSISTENCY.md](docs/CONSISTENCY.md) | 人物/场景/镜头一致性圣经 |
| [docs/VOICE_CASTING.md](docs/VOICE_CASTING.md) | 豆包/阿里选角记录（选完后预渲染） |
| [content/manifest.js](content/manifest.js) | Part 清单与状态 |

## 运行

需要本地静态服务器（ES modules 不能直接双击 HTML）。

**推荐（Windows 务必用这个，避免 `.js` 被当成 text/plain）：**

```bash
python serve.py 5173
```

然后打开：http://127.0.0.1:5173/

也可用：`npx --yes serve .`  
不要用裸的 `python -m http.server`（在部分 Windows 上会让模块脚本加载失败并卡在启动页）。

## 操作

| 按键 | 作用 |
|------|------|
| **空格** | 播放 / 暂停剧情 |
| **← →** 或界面按钮 | 上一句 / 下一句 |
| **1–5** | 跳转章节 |
| **M** / 右上角按钮 | 配音开关 |
| 音量滑条 | 调节配音音量 |
| **点击画面** | 锁定鼠标，自由旁观（并解锁浏览器语音） |
| **WASD** | 自由飞行（沿视线，抬头前进会上升） |
| **QE** / **PgUp·PgDn** | 垂直升降 |
| **滚轮** | 快速调高度（自由探索时） |
| **Shift** | 加速 |
| **F** | 切换「跟随对话镜头 / 自由视角」 |
| **R** | 重置为当前台词的电影镜头 |

## 配音

使用浏览器 **Web Speech API**（系统中文语音），按角色分配不同声线：

| 角色 | 风格 |
|------|------|
| **哲学家** | 低沉、偏慢，年长学者 |
| **青年** | 偏高、偏快，急切质问 |
| **旁白** | 从容叙事（优先女声若系统有） |

首次需要用户点击/按键后浏览器才允许出声。可在 `voice.js` 的 `VOICE_PROFILES` / `registerRole()` 扩展后续人物。

## 章节

1. **引言 · 拜访** — 青年夜访哲学家
2. **第一夜 · 不幸** — 目的论 vs 原因论
3. **世界是单纯的** — 课题分离
4. **勇气** — 「自由就是被别人讨厌的勇气」
5. **尾声 · 雪** — 踏出第一步

## 结构

```
index.html    UI 壳
style.css     夜色书房风界面
main.js       渲染循环、旁观操控、剧情播放
world.js      古都郊外 + 书房场景（程序化）
characters.js 哲学家 / 青年低多边形角色与手势
story.js      台词时间线与章节
```

## 说明

- 纯前端，无构建步骤；Three.js 经 CDN import map 加载。
- 角色为风格化低模，镜头与走位按台词 `camera` / 章节触发。
- 适合作为「可旁观的故事世界」原型继续扩展（更多夜晚、分支选择、语音等）。
