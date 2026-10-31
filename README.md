# 阈限空间 Liminal Space

一个基于 Web 的 3D 阈限空间探索体验，支持桌面浏览器、移动端触摸和 VR 头显（Pico / Quest）。

## 技术栈

- **Vite** + **React 19** + **TypeScript** — 开发框架
- **React Three Fiber** — 3D 渲染引擎
- **@react-three/drei** — 3D 工具库
- **@react-three/xr** — WebXR / VR 支持
- **@react-three/postprocessing** — 后处理特效
- **Zustand** — 状态管理
- **Three.js** — 底层 3D 引擎
- **nipplejs** — 移动端虚拟摇杆

## 空间列表

| 关卡 | 名称 | 描述 |
|------|------|------|
| Level 0 | **The Backrooms** | 经典黄色墙壁、地毯、荧光灯迷宫，无限延伸 |
| Level 37 | **The Poolrooms** | 蓝色瓷砖、水面、柱子组成的空旷泳池空间 |
| - | **The Void Station** | 立体悬浮平台 + 走廊 + 低矮护栏的宇宙中转站，动态加载，背景含星云与星系 |
| - | **演唱会 360°** | 周杰伦 2022 嘉年华演唱会（新加坡站）360° 全景视频，原地环顾，支持 VR（Pico） |

空间之间通过 **时空传送门（Portal）** 连接，走近后触发虫洞隧道穿越动画。三个探索场景里各有一扇粉色的「演唱会 360°」传送门。

## 演唱会（360° 视频场景）

### 放置视频（首次使用必做）

视频体积大且版权归原作者，**不入库**（已在 `.gitignore` 里忽略），需要手动放到：

```
public/video/jay-2022-singapore-3.mp4
```

- 来源：B 站 UP 主「李家肥」的 360° 全景系列（[BV1fA411Q7xJ](https://www.bilibili.com/video/BV1fA411Q7xJ)）
- 格式要求：**H.264 + AAC 的 MP4**，单眼等距柱状（equirectangular，宽高比 2:1）。当前这个视频是 1920×960 / 30fps / 约 2.8Mbps，Pico 3 / Pico 4 浏览器可直接硬解，无需转码
- 不要用 AV1 / 8K 版本：Pico 3 的芯片不支持 AV1 硬解，过高分辨率也会让 WebGL 纹理上传吃不消
- 想换成系列里的其它视频：改 `src/utils/concertVideo.ts` 里的 `CONCERT_VIDEO_FILE` / `CONCERT_TITLE`
- 没放视频时进入场景会显示「找不到视频文件」的提示，不影响其它场景

### 实现要点

- 全景球（`SphereGeometry` 翻转朝内）+ `VideoTexture`，球心每帧跟随头部位置，画面像天空盒一样“无限远”，头部平移不会出现视差
- 视频在第一次进入演唱会（虫洞动画期间）才开始加载；离开时暂停，再进入从上次进度继续
- 演唱会里不可移动，只能原地环顾；VR 里右摇杆仍可转身
- 带声音的自动播放被浏览器拦截时，会降级为静音播放，并提示「开声音」

### 演唱会里的操作

| 端 | 操作 |
|----|------|
| 桌面 | 鼠标环顾；**空格** 播放/暂停；**←/→** 快退/快进 10 秒；**M** 静音；**Q** 离开；ESC 释放鼠标后可点底部控制条 |
| 手机 | 滑动环顾；底部控制条（播放、±10s、进度条、静音、离开） |
| VR（Pico） | 头部追踪环顾；**右 A** 播放/暂停；**右 B** 静音；**左摇杆左右** 快退/快进 10 秒；**右摇杆** 转身；**左 X / 左 Y** 下一个 / 上一个场景（任何场景都可用）；**低头**出现控制面板，用手柄射线扳机点按钮 / 点进度条跳转 / 点「去 xx」直接切场景 |

> 不戴头显也能预览 VR 面板：地址后加 `?vrpanel=1`（如 `https://localhost:5173/?vrpanel=1`），进入演唱会后用鼠标往下看，按 ESC 释放鼠标即可点击面板。

## 快速开始

```bash
# 安装依赖
yarn install

# 启动开发服务器（端口若被占用会自动顺延，如 5174）
yarn dev

# 构建生产版本
yarn build
```

## 操作方式

### 桌面浏览器
- **WASD / 方向键** — 移动
- **鼠标** — 环顾四周
- **ESC** — 释放鼠标指针
- 点击画面重新锁定鼠标

### 移动端（手机 / 平板 / Pico 浏览器模式）
- **左侧摇杆** — 按住拖拽移动
- **右侧区域** — 滑动旋转视角

### VR 头显（Pico / Quest）
- 点击页面右下角 **Enter VR** 进入沉浸式 VR 模式
- 进入后为完整 360 度头部追踪 + 手柄控制（Pico 目前主要识别左手柄）
- 若未进入 360 沉浸式，说明浏览器当前未成功开启 `immersive-vr`（仅普通全屏不等于 VR）
- VR 内左上角面板可显示手柄状态；**左手柄 X = 下一个场景，Y = 上一个场景**（Backrooms → Pool → Void → 演唱会 循环），切换后眼前会弹出场景名提示

### Debug 面板
- 左上角 **齿轮图标** 展开 Debug 面板
- 查看实时 FPS
- 手动切换输入模式（auto / desktop / mobile / vr）
- 直接传送到指定关卡
- 一键打开 WebXR 官方测试页（免复制 URL）

## HTTPS 开发证书（自签名）

- 已启用 `@vitejs/plugin-basic-ssl`，`yarn dev` 默认提供 HTTPS
- 首次访问时浏览器会提示证书不受信任，选择继续访问即可（开发环境正常现象）

## 项目结构

```
src/
├── main.tsx                  # 入口
├── App.tsx                   # 根组件
├── index.css                 # 全局样式
├── store/
│   ├── gameStore.ts          # Zustand 状态（关卡、过渡、输入模式）
│   └── inputState.ts         # 移动端输入共享状态
├── types/
│   └── nipplejs.d.ts         # nipplejs 类型声明
├── components/
│   ├── Scene.tsx             # Canvas + XR 主场景
│   ├── FPSControls.tsx       # 第一人称控制器（桌面+移动端）
│   ├── MobileControls.tsx    # 虚拟摇杆 + 触摸旋转
│   ├── HUD.tsx               # 界面覆盖层
│   ├── StartScreen.tsx       # 启动画面
│   ├── DebugPanel.tsx        # FPS + 模式切换调试面板
│   ├── ConcertControls.tsx   # 演唱会：桌面 / 手机端控制条 + 键盘快捷键
│   ├── ConcertVRPanel.tsx    # 演唱会：VR 低头控制面板 + 手柄快捷键 + 状态提示
│   └── VRSceneSwitcher.tsx   # VR 内左 X / 左 Y 快速切换场景 + 切换提示
├── spaces/
│   ├── SpaceManager.tsx      # 空间切换 + 虫洞过渡
│   ├── BackroomsLevel.tsx    # Level 0 Backrooms
│   ├── BackroomsChunk.tsx    # Backrooms 区块渲染
│   ├── PoolRoomLevel.tsx     # Poolrooms 泳池空间
│   ├── VoidStationLevel.tsx  # 宇宙空间站（立体走廊网络）
│   ├── ConcertLevel.tsx      # 演唱会 360° 全景视频球
│   └── Portal.tsx            # 时空传送门
├── effects/
│   ├── Atmosphere.tsx        # 雾气、环境光
│   ├── FluorescentLight.tsx  # 荧光灯（含闪烁效果）
│   ├── PlayerLight.tsx       # 跟随玩家的动态光源
│   └── WormholeTransition.tsx # 虫洞穿越动画
├── utils/
│   ├── concertVideo.ts       # 360° 视频控制器单例（播放状态 / 预加载 / 自动播放降级）
│   ├── concertActions.ts     # 离开演唱会（暂停 + 虫洞传送回原场景）
│   ├── levels.ts             # 场景列表 / 顺序（VR 手柄 X / Y 切换用）
│   └── canvasDraw.ts         # Canvas 绘制小工具（圆角矩形）
└── procedural/
    ├── mazeGenerator.ts      # 迷宫生成算法（种子随机 + DFS）
    └── textureFactory.ts     # 程序化纹理生成

public/
├── audio/                    # 三个场景的 BGM
└── video/                    # 360° 视频（不入库，需手动放入，见上文）
```

## 穿越效果

走近传送门后触发虫洞隧道动画：
1. 圆柱隧道包围玩家
2. 2000+ 星点粒子高速旋转前冲
3. 隧道壁面 GLSL shader 渲染星空网格
4. 尽头白光逐渐扩大
5. 2.5 秒后切换到目标空间

## 输入模式检测

系统自动检测平台类型：
- 有触摸支持 → 移动端模式（显示摇杆）
- 无触摸 → 桌面模式（鼠标锁定）
- 可通过 Debug 面板手动覆盖

## 设计理念

- **不是恐怖游戏** — 强调好奇心和探索感，适合小朋友
- **时空穿越** — 通过虫洞隧道在不同阈限空间之间穿梭
- **程序化生成** — 所有场景均由算法生成，每次都不同
- **无限延伸** — 基于 Chunk 的动态加载，空间无边界
- **多平台** — 桌面、移动端、VR 头显统一支持

## 后续计划（主线）

- [ ] **更多、更好的空间**：继续扩展空间类型，并强化音效 / 视觉 / 动画表现
- [x] **NPC 互动**：加入不同场景的生物实体
  - Backrooms: 暗影生物（靠近玩家时逃逸）
  - Poolrooms: 发光水母 + 鱼群（InstancedMesh 高性能）
  - Void Station: 外星无人机/光球（轨道巡航）
- [ ] **MMO 实时多人**：多人同场景同步、位置广播、交互状态同步

## 当前版本

- `v0.1.18`
- 新增「演唱会 360°」场景：360° 全景视频 + 桌面 / 手机 / VR（Pico）控制，三个场景里各有一扇传送门
- 第三空间已切换为 `Void Station`
- Void Station 采用程序化立体网格 + 邻近动态渲染（Pico 3 友好）
- 三个场景均已加入 NPC 生物（暗影生物/水母鱼群/外星无人机）
- 三个场景已接入独立 BGM（`public/audio/*.mp3`，循环播放）
- 音频资源来源：OpenGameArt（CC0 / Public Domain，无需署名，可商用）
