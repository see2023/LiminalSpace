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

空间之间通过 **时空传送门（Portal）** 连接，走近后触发虫洞隧道穿越动画。

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
- VR 内左上角面板可显示手柄状态，并支持快捷场景切换（X / Y）

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
│   └── DebugPanel.tsx        # FPS + 模式切换调试面板
├── spaces/
│   ├── SpaceManager.tsx      # 空间切换 + 虫洞过渡
│   ├── BackroomsLevel.tsx    # Level 0 Backrooms
│   ├── BackroomsChunk.tsx    # Backrooms 区块渲染
│   ├── PoolRoomLevel.tsx     # Poolrooms 泳池空间
│   ├── VoidStationLevel.tsx  # 宇宙空间站（立体走廊网络）
│   └── Portal.tsx            # 时空传送门
├── effects/
│   ├── Atmosphere.tsx        # 雾气、环境光
│   ├── FluorescentLight.tsx  # 荧光灯（含闪烁效果）
│   ├── PlayerLight.tsx       # 跟随玩家的动态光源
│   └── WormholeTransition.tsx # 虫洞穿越动画
└── procedural/
    ├── mazeGenerator.ts      # 迷宫生成算法（种子随机 + DFS）
    └── textureFactory.ts     # 程序化纹理生成
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

- `v0.1.16`
- 第三空间已切换为 `Void Station`
- Void Station 采用程序化立体网格 + 邻近动态渲染（Pico 3 友好）
- 三个场景均已加入 NPC 生物（暗影生物/水母鱼群/外星无人机）
- 三个场景已接入独立 BGM（`public/audio/*.mp3`，循环播放）
- 音频资源来源：OpenGameArt（CC0 / Public Domain，无需署名，可商用）
