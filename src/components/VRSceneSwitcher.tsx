import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import * as THREE from 'three'
import { gameStore } from '../store/gameStore'
import { LEVELS, levelIndex, nextLevel } from '../utils/levels'
import type { LevelInfo } from '../utils/levels'
import { roundRect } from '../utils/canvasDraw'
import { remoteLog } from '../utils/remoteLog'

/**
 * VR 里随时可用的快速切换场景（所有场景通用，不需要找传送门）：
 *   左手柄 X = 下一个场景，左手柄 Y = 上一个场景（顺序见 utils/levels.ts，循环）。
 * 切换后在眼前显示 2 秒提示：当前场景名 + 序号。
 *
 * 每一帧都检测按键（边沿触发），按一下就切一次，不会漏按。
 */

const TOAST_W = 1024
const TOAST_H = 192
const TOAST_SECONDS = 2.2
const TOAST_DISTANCE = 1.8
const TOAST_DROP = 0.25

// Pico 手柄：左手 buttons[4] = X，buttons[5] = Y（与右手 A=4 / B=5 同一套索引）
const BTN_X = 4
const BTN_Y = 5

function drawToast(ctx: CanvasRenderingContext2D, level: LevelInfo) {
  ctx.clearRect(0, 0, TOAST_W, TOAST_H)
  roundRect(ctx, 4, 4, TOAST_W - 8, TOAST_H - 8, 44)
  ctx.fillStyle = 'rgba(8, 10, 24, 0.9)'
  ctx.fill()
  ctx.strokeStyle = level.color
  ctx.lineWidth = 4
  ctx.stroke()

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillStyle = level.color
  ctx.font = 'bold 56px sans-serif'
  ctx.fillText(level.name, TOAST_W / 2, 74)

  ctx.fillStyle = 'rgba(210, 222, 255, 0.85)'
  ctx.font = '30px sans-serif'
  ctx.fillText(`${levelIndex(level.id) + 1} / ${LEVELS.length}    左X 下一个   左Y 上一个`, TOAST_W / 2, 136)
}

function Switcher() {
  const meshRef = useRef<THREE.Mesh>(null)
  const prevX = useRef(false)
  const prevY = useRef(false)
  const toastLeft = useRef(0)

  const { canvas, texture } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = TOAST_W
    c.height = TOAST_H
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return { canvas: c, texture: t }
  }, [])

  useEffect(() => () => texture.dispose(), [texture])

  const head = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera, gl }, delta) => {
    if (!gl.xr.isPresenting) return
    const session = gl.xr.getSession()

    // 1. 读左手 X / Y（每帧边沿检测）
    let xDown = false
    let yDown = false
    if (session) {
      for (let i = 0; i < session.inputSources.length; i++) {
        const src = session.inputSources[i]
        if (src.handedness !== 'left' || !src.gamepad) continue
        xDown = !!src.gamepad.buttons[BTN_X]?.pressed
        yDown = !!src.gamepad.buttons[BTN_Y]?.pressed
      }
    }

    const { transitioning, currentLevel, setLevel } = gameStore.getState()
    const step = xDown && !prevX.current ? 1 : yDown && !prevY.current ? -1 : 0
    prevX.current = xDown
    prevY.current = yDown

    if (step !== 0 && !transitioning) {
      const target = nextLevel(currentLevel, step)
      setLevel(target.id)
      remoteLog('info', `[VR] Level switch -> ${target.id}`)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        drawToast(ctx, target)
        texture.needsUpdate = true
      }
      toastLeft.current = TOAST_SECONDS
    }

    // 2. 提示条：跟随视线，显示几秒后消失
    const mesh = meshRef.current
    if (!mesh) return
    if (toastLeft.current > 0) toastLeft.current -= delta
    mesh.visible = toastLeft.current > 0
    if (!mesh.visible) return

    camera.getWorldPosition(head)
    camera.getWorldDirection(dir)
    mesh.position.copy(head).addScaledVector(dir, TOAST_DISTANCE)
    mesh.position.y -= TOAST_DROP
    mesh.lookAt(head)
  })

  return (
    <mesh ref={meshRef} renderOrder={9999} visible={false}>
      <planeGeometry args={[1.2, 1.2 * (TOAST_H / TOAST_W)]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} depthTest={false} depthWrite={false} />
    </mesh>
  )
}

/** VR 会话期间才挂载 */
export function VRSceneSwitcher() {
  const isPresenting = useXR((s) => s.session != null)
  if (!isPresenting) return null
  return <Switcher />
}
