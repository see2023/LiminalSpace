import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import * as THREE from 'three'
import {
  CONCERT_TITLE,
  SEEK_STEP_LONG,
  SEEK_STEP_SHORT,
  concertVideo,
  formatTime,
  useConcertVideoState,
} from '../utils/concertVideo'
import type { ConcertState } from '../utils/concertVideo'
import { leaveConcert } from '../utils/concertActions'
import { gameStore } from '../store/gameStore'
import type { LevelType } from '../store/gameStore'
import { LEVELS } from '../utils/levels'
import { roundRect } from '../utils/canvasDraw'

/**
 * VR 内的演唱会控制：
 * 1. 低头面板：低头时出现在身前下方，用手柄射线（扳机）点击按钮 / 进度条 / 切换场景
 * 2. 手柄快捷键：右 A 播放/暂停，右 B 静音，左摇杆左右快退/快进
 *    （左 X / 左 Y 切换场景由 VRSceneSwitcher 统一处理，所有场景通用）
 * 3. 状态提示：加载 / 缓冲 / 出错时在视野中央下方显示一行字
 */

const CANVAS_W = 1024
const CANVAS_H = 608
const PANEL_W = 1.1
const PANEL_H = PANEL_W * (CANVAS_H / CANVAS_W)
const PANEL_DISTANCE = 1.0
const PANEL_DROP = 0.65
const SHOW_PITCH = -0.35 // 低头超过约 20° 显示
const HIDE_PITCH = -0.2
const FOLLOW_YAW = 1.0 // 头部转过约 57° 后，面板转到新的朝向

const BAR = { x: 40, y: 84, w: 944, h: 56 }
const BTN = { y: 196, h: 140, w: 172, gap: 21 }
type ButtonId = 'back' | 'toggle' | 'forward' | 'mute' | 'exit'
const BUTTON_IDS: ButtonId[] = ['back', 'toggle', 'forward', 'mute', 'exit']

function buttonX(index: number) {
  return BAR.x + index * (BTN.w + BTN.gap)
}

/** 切换场景的小按钮（除演唱会自己以外的场景），一行三个 */
const SCENE_LEVELS = LEVELS.filter((l) => l.id !== 'concert')
const SCENE_BTN = { y: 358, h: 84, gap: 28 }
const SCENE_BTN_W = (BAR.w - SCENE_BTN.gap * (SCENE_LEVELS.length - 1)) / SCENE_LEVELS.length

function sceneButtonX(index: number) {
  return BAR.x + index * (SCENE_BTN_W + SCENE_BTN.gap)
}

function statusText(s: ConcertState): { text: string; color: string } | null {
  if (s.error) return { text: s.error, color: '#ff8a8a' }
  if (!s.hasFrame) return { text: '视频加载中…', color: '#ffe08a' }
  if (s.buffering) return { text: '缓冲中…', color: '#ffe08a' }
  if (s.audioBlocked) return { text: '已静音（浏览器限制），点「开声音」', color: '#ffe08a' }
  return null
}

function drawPanel(ctx: CanvasRenderingContext2D, s: ConcertState) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  ctx.textBaseline = 'middle'

  roundRect(ctx, 4, 4, CANVAS_W - 8, CANVAS_H - 8, 36)
  ctx.fillStyle = 'rgba(8, 10, 24, 0.9)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
  ctx.lineWidth = 3
  ctx.stroke()

  // 标题
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffd0e8'
  ctx.font = 'bold 34px sans-serif'
  ctx.fillText(CONCERT_TITLE, 40, 44)

  // 进度条
  const trackY = BAR.y + BAR.h / 2 - 9
  roundRect(ctx, BAR.x, trackY, BAR.w, 18, 9)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)'
  ctx.fill()

  const duration = s.duration
  if (duration > 0) {
    const bufferedW = Math.max(0, Math.min(1, s.bufferedEnd / duration)) * BAR.w
    if (bufferedW > 0) {
      roundRect(ctx, BAR.x, trackY, bufferedW, 18, 9)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'
      ctx.fill()
    }
    const playedW = Math.max(0, Math.min(1, s.currentTime / duration)) * BAR.w
    if (playedW > 0) {
      roundRect(ctx, BAR.x, trackY, playedW, 18, 9)
      ctx.fillStyle = '#ff5fa8'
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(BAR.x + playedW, trackY + 9, 16, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  }

  // 时间 + 状态
  ctx.font = '28px monospace'
  ctx.fillStyle = '#d8e4ff'
  ctx.fillText(`${formatTime(s.currentTime)} / ${formatTime(duration)}`, BAR.x, 160)
  const status = statusText(s)
  if (status) {
    ctx.textAlign = 'right'
    ctx.font = '26px sans-serif'
    ctx.fillStyle = status.color
    ctx.fillText(status.text, BAR.x + BAR.w, 160)
    ctx.textAlign = 'left'
  }

  // 按钮
  const labels: Record<ButtonId, string> = {
    back: `-${SEEK_STEP_LONG}秒`,
    toggle: s.playing ? '暂停' : s.ended ? '重播' : '播放',
    forward: `+${SEEK_STEP_LONG}秒`,
    mute: s.muted ? '开声音' : '静音',
    exit: '离开',
  }
  BUTTON_IDS.forEach((id, i) => {
    const x = buttonX(i)
    roundRect(ctx, x, BTN.y, BTN.w, BTN.h, 24)
    ctx.fillStyle = id === 'exit' ? 'rgba(200, 70, 90, 0.55)' : id === 'toggle' ? 'rgba(255, 95, 168, 0.55)' : 'rgba(255, 255, 255, 0.14)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.font = 'bold 40px sans-serif'
    ctx.fillText(labels[id], x + BTN.w / 2, BTN.y + BTN.h / 2)
  })

  // 切换场景按钮
  SCENE_LEVELS.forEach((lv, i) => {
    const x = sceneButtonX(i)
    roundRect(ctx, x, SCENE_BTN.y, SCENE_BTN_W, SCENE_BTN.h, 20)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.fill()
    ctx.strokeStyle = lv.color
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = lv.color
    ctx.textAlign = 'center'
    ctx.font = 'bold 36px sans-serif'
    ctx.fillText(`去 ${lv.short}`, x + SCENE_BTN_W / 2, SCENE_BTN.y + SCENE_BTN.h / 2)
  })

  // 手柄提示
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(200, 215, 255, 0.75)'
  ctx.font = '25px sans-serif'
  ctx.fillText('手柄：右A 播放/暂停　右B 静音　左摇杆左右 快退/快进 10 秒', 40, 488)
  ctx.fillText('左X 下一个场景 / 左Y 上一个场景（任何场景都能用）　右摇杆 转身', 40, 532)
  ctx.fillText('点进度条可跳转　抬头回到全景，低头显示本面板', 40, 576)
}

function hitButton(px: number, py: number): ButtonId | null {
  if (py < BTN.y || py > BTN.y + BTN.h) return null
  for (let i = 0; i < BUTTON_IDS.length; i++) {
    const x = buttonX(i)
    if (px >= x && px <= x + BTN.w) return BUTTON_IDS[i]
  }
  return null
}

function hitScene(px: number, py: number): LevelType | null {
  if (py < SCENE_BTN.y || py > SCENE_BTN.y + SCENE_BTN.h) return null
  for (let i = 0; i < SCENE_LEVELS.length; i++) {
    const x = sceneButtonX(i)
    if (px >= x && px <= x + SCENE_BTN_W) return SCENE_LEVELS[i].id
  }
  return null
}

function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

/** 低头才出现的控制面板 */
function ControlPanel() {
  const state = useConcertVideoState()
  const groupRef = useRef<THREE.Group>(null)
  const shownRef = useRef(false)
  const anchorYaw = useRef<number | null>(null)

  const { canvas, texture } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = CANVAS_W
    c.height = CANVAS_H
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return { canvas: c, texture: t }
  }, [])

  useEffect(() => () => texture.dispose(), [texture])

  useEffect(() => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawPanel(ctx, state)
    texture.needsUpdate = true
  }, [state, canvas, texture])

  const head = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera }, delta) => {
    const group = groupRef.current
    if (!group) return

    camera.getWorldPosition(head)
    camera.getWorldDirection(dir)
    const pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1))

    // 低头显示，抬头隐藏（带滞回，避免在阈值附近闪烁）
    if (!shownRef.current && pitch < SHOW_PITCH) shownRef.current = true
    else if (shownRef.current && pitch > HIDE_PITCH) shownRef.current = false
    group.visible = shownRef.current

    // 朝向锚点：头部水平转向超过阈值后，面板缓慢转过去（垂直向下看时水平方向不可靠，忽略）
    if (Math.hypot(dir.x, dir.z) > 0.3) {
      const headYaw = Math.atan2(-dir.x, -dir.z)
      if (anchorYaw.current === null) {
        anchorYaw.current = headYaw
      } else {
        const diff = wrapAngle(headYaw - anchorYaw.current)
        if (Math.abs(diff) > FOLLOW_YAW) {
          anchorYaw.current = wrapAngle(anchorYaw.current + diff * Math.min(1, delta * 3))
        }
      }
    }

    const yaw = anchorYaw.current ?? 0
    group.position.set(
      head.x - Math.sin(yaw) * PANEL_DISTANCE,
      head.y - PANEL_DROP,
      head.z - Math.cos(yaw) * PANEL_DISTANCE,
    )
    group.lookAt(head)
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!shownRef.current) return
    e.stopPropagation()
    const uv = e.uv
    if (!uv) return
    const px = uv.x * CANVAS_W
    const py = (1 - uv.y) * CANVAS_H

    if (px >= BAR.x && px <= BAR.x + BAR.w && py >= BAR.y && py <= BAR.y + BAR.h) {
      concertVideo.seekToFraction((px - BAR.x) / BAR.w)
      return
    }

    const scene = hitScene(px, py)
    if (scene) {
      const { transitioning, setLevel } = gameStore.getState()
      if (!transitioning) setLevel(scene)
      return
    }

    switch (hitButton(px, py)) {
      case 'back':
        concertVideo.seekBy(-SEEK_STEP_LONG)
        break
      case 'forward':
        concertVideo.seekBy(SEEK_STEP_LONG)
        break
      case 'toggle':
        concertVideo.toggle()
        break
      case 'mute':
        concertVideo.toggleMute()
        break
      case 'exit':
        leaveConcert()
        break
    }
  }

  return (
    <group ref={groupRef} visible={false}>
      <mesh renderOrder={9998} onClick={onClick}>
        <planeGeometry args={[PANEL_W, PANEL_H]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** 加载 / 缓冲 / 出错时，视野中央偏下显示一行状态 */
function StatusToast() {
  const state = useConcertVideoState()
  const meshRef = useRef<THREE.Mesh>(null)

  const { canvas, texture } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 128
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return { canvas: c, texture: t }
  }, [])

  useEffect(() => () => texture.dispose(), [texture])

  const status = statusText(state)
  // 低头面板里已有“已静音”提示，这里只提示加载 / 缓冲 / 出错
  const toastText = status && !state.audioBlocked ? status.text : null
  const toastColor = status?.color ?? '#ffffff'

  useEffect(() => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 1024, 128)
    if (toastText) {
      roundRect(ctx, 4, 4, 1016, 120, 40)
      ctx.fillStyle = 'rgba(8, 10, 24, 0.82)'
      ctx.fill()
      ctx.fillStyle = toastColor
      ctx.font = 'bold 40px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const text = toastText.length > 28 ? `${toastText.slice(0, 27)}…` : toastText
      ctx.fillText(text, 512, 66)
    }
    texture.needsUpdate = true
  }, [toastText, toastColor, canvas, texture])

  const head = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera }) => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.visible = toastText !== null
    if (!toastText) return
    camera.getWorldPosition(head)
    camera.getWorldDirection(dir)
    mesh.position.copy(head).addScaledVector(dir, 2.0)
    mesh.position.y -= 0.35
    mesh.lookAt(head)
  })

  return (
    <mesh ref={meshRef} renderOrder={9999} visible={false}>
      <planeGeometry args={[1.0, 0.125]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} depthTest={false} depthWrite={false} />
    </mesh>
  )
}

/** 手柄快捷键 */
function ConcertShortcuts() {
  const prevA = useRef(false)
  const prevB = useRef(false)
  const stickCooldown = useRef(0)

  useFrame(({ gl }, delta) => {
    if (!gl.xr.isPresenting) return
    const session = gl.xr.getSession()
    if (!session) return
    if (gameStore.getState().transitioning) return

    if (stickCooldown.current > 0) stickCooldown.current -= delta

    let aDown = false
    let bDown = false
    let stickX = 0

    for (let i = 0; i < session.inputSources.length; i++) {
      const src = session.inputSources[i]
      const gp = src.gamepad
      if (!gp) continue
      if (src.handedness === 'right') {
        aDown = !!gp.buttons[4]?.pressed
        bDown = !!gp.buttons[5]?.pressed
      } else if (src.handedness === 'left') {
        stickX = gp.axes[2] ?? gp.axes[0] ?? 0
      }
    }

    if (aDown && !prevA.current) concertVideo.toggle()
    if (bDown && !prevB.current) concertVideo.toggleMute()
    prevA.current = aDown
    prevB.current = bDown

    if (Math.abs(stickX) > 0.7 && stickCooldown.current <= 0) {
      concertVideo.seekBy(stickX > 0 ? SEEK_STEP_SHORT : -SEEK_STEP_SHORT)
      stickCooldown.current = 0.45
    }
  })

  return null
}

/** 在地址后加 ?vrpanel=1，可以不戴头显、直接在电脑上预览 / 调试 VR 面板（低头显示，ESC 释放鼠标后可点击） */
const PREVIEW_PANEL_ON_DESKTOP = new URLSearchParams(window.location.search).has('vrpanel')

export function ConcertVRPanel() {
  const isPresenting = useXR((s) => s.session != null)
  if (!isPresenting && !PREVIEW_PANEL_ON_DESKTOP) return null
  return (
    <>
      <ControlPanel />
      <StatusToast />
      <ConcertShortcuts />
    </>
  )
}
