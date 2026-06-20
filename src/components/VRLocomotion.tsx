import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { XROrigin, useXRControllerLocomotion, useXRInputSourceState, useXR } from '@react-three/xr'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import type { LevelType } from '../store/gameStore'
import { APP_VERSION } from '../version'
import { isWallAt, isVoidWalkable, getVoidCellData, getPoolFloorHeight, isPoolWall, VS_CELL, PLAYER_RADIUS } from '../utils/collision'

const VR_MOVE_SPEED = 5
const SWIM_SPEED = 4
const SWIM_THRESHOLD = 0.3
const DEADZONE = 0.15

function sendLog(level: string, msg: string) {
  try {
    const url = `${window.location.origin}/__vr_log`
    navigator.sendBeacon?.(url, JSON.stringify({ level, msg }))
  } catch { /* */ }
}

export function VRLocomotion() {
  const originRef = useRef<THREE.Group>(null!)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const transitioning = useGameStore((s) => s.transitioning)

  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')

  const prevLeftPos = useRef(new THREE.Vector3())
  const prevRightPos = useRef(new THREE.Vector3())
  const swimVel = useRef(new THREE.Vector3())
  const initialized = useRef(false)
  const _dir = useRef(new THREE.Vector3())
  const _right = useRef(new THREE.Vector3())
  const _up = useRef(new THREE.Vector3(0, 1, 0))
  const logTimer = useRef(0)
  const didLogOnce = useRef(false)

  useXRControllerLocomotion(
    originRef,
    { speed: VR_MOVE_SPEED },
    { type: 'smooth', speed: 1.8 },
    'left',
  )

  useEffect(() => {
    if (!originRef.current) return
    if (currentLevel === 'backrooms') {
      originRef.current.position.set(6, 0, 6)
    } else if (currentLevel === 'poolrooms') {
      originRef.current.position.set(-32.5, 0.2, -32.5) // Walkway height is 0.2
    } else if (currentLevel === 'voidstation') {
      originRef.current.position.set(0, 0, 0)
    }
  }, [currentLevel])

  useFrame(({ camera, gl }, delta) => {
    if (!gl.xr.isPresenting) return

    const session = gl.xr.getSession()

    logTimer.current += delta
    if (logTimer.current > 3 && !didLogOnce.current) {
      didLogOnce.current = true
      const sources = session?.inputSources
      const info = sources
        ? Array.from(sources).map(s => `${s.handedness}:profiles=[${s.profiles.join(',')}],axes=${s.gamepad?.axes.length ?? 'none'}`).join(' | ')
        : 'no session'
      sendLog('info', `[VRLoco] controllers: left=${!!leftController} right=${!!rightController} | sources: ${info}`)
    }

    if (transitioning) return

    if (session && originRef.current) {
      const sources = session.inputSources
      let fwd = 0, strafe = 0, turn = 0

      for (let i = 0; i < sources.length; i++) {
        const src = sources[i]
        const gp = src.gamepad
        if (!gp) continue

        if (src.handedness === 'left') {
          const x = gp.axes[2] ?? gp.axes[0] ?? 0
          const y = gp.axes[3] ?? gp.axes[1] ?? 0
          if (Math.abs(x) > DEADZONE) strafe = x
          if (Math.abs(y) > DEADZONE) fwd = -y
        } else if (src.handedness === 'right') {
          const x = gp.axes[2] ?? gp.axes[0] ?? 0
          if (Math.abs(x) > DEADZONE) turn = x
        }
      }

      if (Math.abs(fwd) > 0.01 || Math.abs(strafe) > 0.01) {
        camera.getWorldDirection(_dir.current)
        _dir.current.y = 0
        _dir.current.normalize()
        _right.current.crossVectors(_dir.current, _up.current).normalize()

        const moveX = (fwd * _dir.current.x + strafe * _right.current.x) * VR_MOVE_SPEED * delta
        const moveZ = (fwd * _dir.current.z + strafe * _right.current.z) * VR_MOVE_SPEED * delta

        const camWorld = new THREE.Vector3()
        camera.getWorldPosition(camWorld)
        const newX = camWorld.x + moveX
        const newZ = camWorld.z + moveZ

        let blockXZ = false

        if (currentLevel === 'voidstation') {
          const gy = Math.round(originRef.current.position.y / VS_CELL)
          const gx = Math.round(camWorld.x / VS_CELL)
          const gz = Math.round(camWorld.z / VS_CELL)
          const lx = camWorld.x - gx * VS_CELL
          const lz = camWorld.z - gz * VS_CELL

          const cell = getVoidCellData(gx, gy, gz)
          const cellAbove = getVoidCellData(gx, gy + 1, gz)
          const cellBelow = getVoidCellData(gx, gy - 1, gz)

          const canGoUp = cell.connectY && cellAbove.exists
          const canGoDown = cellBelow.connectY && cellBelow.exists

          let targetY = gy * VS_CELL

          if (canGoUp && Math.hypot(lx - 1.2, lz - 1.2) < 0.7) {
            targetY = (gy + 1) * VS_CELL
          } else if (canGoDown && Math.hypot(lx - (-1.2), lz - (-1.2)) < 0.7) {
            targetY = (gy - 1) * VS_CELL
          }

          originRef.current.position.y = THREE.MathUtils.lerp(originRef.current.position.y, targetY, delta * 4)

          if (Math.abs(originRef.current.position.y - gy * VS_CELL) > 0.5) {
            blockXZ = true
          }
        }

        if (!blockXZ) {
          if (currentLevel === 'backrooms') {
            if (!isWallAt(newX + Math.sign(moveX) * PLAYER_RADIUS, camWorld.z)) {
              originRef.current.position.x += moveX
            }
            if (!isWallAt(camWorld.x, newZ + Math.sign(moveZ) * PLAYER_RADIUS)) {
              originRef.current.position.z += moveZ
            }
          } else if (currentLevel === 'voidstation') {
            if (isVoidWalkable(newX + Math.sign(moveX) * PLAYER_RADIUS, camWorld.y, camWorld.z)) {
              originRef.current.position.x += moveX
            }
            if (isVoidWalkable(camWorld.x, camWorld.y, newZ + Math.sign(moveZ) * PLAYER_RADIUS)) {
              originRef.current.position.z += moveZ
            }
          } else if (currentLevel === 'poolrooms') {
            if (!isPoolWall(newX + Math.sign(moveX) * PLAYER_RADIUS, camWorld.z)) {
              originRef.current.position.x += moveX
            }
            if (!isPoolWall(camWorld.x, newZ + Math.sign(moveZ) * PLAYER_RADIUS)) {
              originRef.current.position.z += moveZ
            }
          } else {
            originRef.current.position.x += moveX
            originRef.current.position.z += moveZ
          }
        }
      } else if (currentLevel === 'voidstation') {
        // Even if not moving XZ, we might be standing on a pad and need to move Y
        const camWorld = new THREE.Vector3()
        camera.getWorldPosition(camWorld)
        const gy = Math.round(originRef.current.position.y / VS_CELL)
        const gx = Math.round(camWorld.x / VS_CELL)
        const gz = Math.round(camWorld.z / VS_CELL)
        const lx = camWorld.x - gx * VS_CELL
        const lz = camWorld.z - gz * VS_CELL

        const cell = getVoidCellData(gx, gy, gz)
        const cellAbove = getVoidCellData(gx, gy + 1, gz)
        const cellBelow = getVoidCellData(gx, gy - 1, gz)

        const canGoUp = cell.connectY && cellAbove.exists
        const canGoDown = cellBelow.connectY && cellBelow.exists

        let targetY = gy * VS_CELL

        if (canGoUp && Math.hypot(lx - 1.2, lz - 1.2) < 0.7) {
          targetY = (gy + 1) * VS_CELL
        } else if (canGoDown && Math.hypot(lx - (-1.2), lz - (-1.2)) < 0.7) {
          targetY = (gy - 1) * VS_CELL
        }

        originRef.current.position.y = THREE.MathUtils.lerp(originRef.current.position.y, targetY, delta * 4)
      }

      if (Math.abs(turn) > 0.01) {
        originRef.current.rotation.y -= turn * 1.8 * delta
      }
    }

    // Swimming mechanic (pool level only)
    if (currentLevel === 'poolrooms' && originRef.current) {
      const floorY = getPoolFloorHeight(originRef.current.position.x, originRef.current.position.z)
      let targetY = floorY
      if (floorY < -1.0) {
        // Deep water: float so head is above water
        // Assuming player height is ~1.6, origin at -1.0 puts head at 0.6
        targetY = -1.0
      }
      originRef.current.position.y = THREE.MathUtils.lerp(originRef.current.position.y, targetY, delta * 12)

      const frame = gl.xr.getFrame()
      const refSpace = gl.xr.getReferenceSpace()
      if (!frame || !refSpace) return

      const leftInput = leftController?.inputSource
      const rightInput = rightController?.inputSource

      if (leftInput?.gripSpace && rightInput?.gripSpace) {
        const leftPose = frame.getPose(leftInput.gripSpace, refSpace)
        const rightPose = frame.getPose(rightInput.gripSpace, refSpace)

        if (leftPose && rightPose) {
          const lp = new THREE.Vector3(
            leftPose.transform.position.x,
            leftPose.transform.position.y,
            leftPose.transform.position.z,
          )
          const rp = new THREE.Vector3(
            rightPose.transform.position.x,
            rightPose.transform.position.y,
            rightPose.transform.position.z,
          )

          if (!initialized.current) {
            prevLeftPos.current.copy(lp)
            prevRightPos.current.copy(rp)
            initialized.current = true
            return
          }

          const leftVel = lp.clone().sub(prevLeftPos.current).divideScalar(Math.max(delta, 0.001))
          const rightVel = rp.clone().sub(prevRightPos.current).divideScalar(Math.max(delta, 0.001))

          const combinedSpeed = (leftVel.length() + rightVel.length()) * 0.5

          if (combinedSpeed > SWIM_THRESHOLD) {
            camera.getWorldDirection(_dir.current)
            _dir.current.y = 0
            _dir.current.normalize()
            const impulse = _dir.current.clone().multiplyScalar(
              Math.min(combinedSpeed, 3) * SWIM_SPEED * delta
            )
            swimVel.current.lerp(impulse, 0.4)
          } else {
            swimVel.current.multiplyScalar(0.93)
          }

          prevLeftPos.current.copy(lp)
          prevRightPos.current.copy(rp)
        }
      }

      if (swimVel.current.length() > 0.001) {
        const newX = originRef.current.position.x + swimVel.current.x
        const newZ = originRef.current.position.z + swimVel.current.z
        if (!isPoolWall(newX, originRef.current.position.z)) originRef.current.position.x = newX
        if (!isPoolWall(originRef.current.position.x, newZ)) originRef.current.position.z = newZ
      }
    }
  })

  return <XROrigin ref={originRef} />
}

const LEVELS: { id: LevelType; label: string; color: string }[] = [
  { id: 'backrooms', label: 'Backrooms', color: '#f0d060' },
  { id: 'poolrooms', label: 'Pool', color: '#60c0f0' },
  { id: 'voidstation', label: 'Void', color: '#8060f0' },
]

export function VRDebugHUD() {
  const meshRef = useRef<THREE.Mesh>(null)
  const isPresenting = useXR((s) => s.session != null)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const setLevel = useGameStore((s) => s.setLevel)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textureRef = useRef<THREE.CanvasTexture | null>(null)
  const frameCount = useRef(0)
  const lastUpdate = useRef(0)
  const fpsRef = useRef(0)
  const controllerInfoRef = useRef('')
  const buttonHitRef = useRef(-1)

  if (!canvasRef.current) {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    canvasRef.current = canvas
    textureRef.current = new THREE.CanvasTexture(canvas)
  }

  useFrame(({ camera, gl: renderer }) => {
    if (!isPresenting) return
    if (!meshRef.current || !canvasRef.current || !textureRef.current) return

    frameCount.current++
    const now = performance.now()
    if (now - lastUpdate.current > 500) {
      fpsRef.current = Math.round(frameCount.current / ((now - lastUpdate.current) / 1000))
      frameCount.current = 0
      lastUpdate.current = now

      const session = renderer.xr.getSession()
      let ctrlInfo = ''
      if (session) {
        const sources = session.inputSources
        for (let i = 0; i < sources.length; i++) {
          const src = sources[i]
          const gp = src.gamepad
          if (gp) {
            const axes = Array.from(gp.axes).map(a => a.toFixed(1)).join(',')
            const btns = gp.buttons.map((b, idx) => b.pressed ? idx : null).filter(x => x !== null)
            ctrlInfo += `${src.handedness}:[${axes}] btn[${btns.join(',')}] `
          }
        }
      }
      controllerInfoRef.current = ctrlInfo || 'No ctrl'

      // Check button presses for level switch
      // Pico left controller: btn[0]=trigger, btn[1]=grip, btn[4]=X, btn[5]=Y
      if (session) {
        for (let i = 0; i < session.inputSources.length; i++) {
          const src = session.inputSources[i]
          const gp = src.gamepad
          if (!gp || src.handedness !== 'left') continue
          // X button (index 4) cycles forward, Y button (index 5) cycles backward
          if (gp.buttons[4]?.pressed && buttonHitRef.current !== 4) {
            buttonHitRef.current = 4
            const idx = LEVELS.findIndex(l => l.id === currentLevel)
            const next = LEVELS[(idx + 1) % LEVELS.length]
            setLevel(next.id)
            sendLog('info', `[VR] Level switch -> ${next.id}`)
          } else if (gp.buttons[5]?.pressed && buttonHitRef.current !== 5) {
            buttonHitRef.current = 5
            const idx = LEVELS.findIndex(l => l.id === currentLevel)
            const prev = LEVELS[(idx - 1 + LEVELS.length) % LEVELS.length]
            setLevel(prev.id)
            sendLog('info', `[VR] Level switch -> ${prev.id}`)
          } else if (!gp.buttons[4]?.pressed && !gp.buttons[5]?.pressed) {
            buttonHitRef.current = -1
          }
        }
      }

      const ctx = canvasRef.current.getContext('2d')!
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
      ctx.fillRect(0, 0, 1024, 512)

      // Header
      ctx.fillStyle = '#00ff88'
      ctx.font = 'bold 36px monospace'
      ctx.fillText(`v${APP_VERSION} | FPS: ${fpsRef.current}`, 20, 44)

      // Controller info
      ctx.fillStyle = '#88ccff'
      ctx.font = '24px monospace'
      ctx.fillText(controllerInfoRef.current, 20, 82)

      // Level buttons display
      ctx.font = 'bold 32px monospace'
      ctx.fillText('Levels (X=next, Y=prev):', 20, 140)
      LEVELS.forEach((lv, i) => {
        const isActive = lv.id === currentLevel
        ctx.fillStyle = isActive ? lv.color : '#666666'
        ctx.font = isActive ? 'bold 36px monospace' : '28px monospace'
        const marker = isActive ? '>>>' : '   '
        ctx.fillText(`${marker} ${lv.label}`, 40, 190 + i * 50)
      })

      // Instructions
      ctx.fillStyle = '#aaaaaa'
      ctx.font = '22px monospace'
      ctx.fillText('Left stick: move | Turn: body', 20, 380)
      ctx.fillText('Trigger: interact | Grip: grab', 20, 410)
      ctx.fillText('X/Y buttons: switch level', 20, 440)

      textureRef.current.needsUpdate = true
    }

    // Position HUD in front of camera, upper left
    const target = new THREE.Vector3()
    camera.getWorldDirection(target)
    target.multiplyScalar(2.5)
    target.add(camera.position)
    target.y += 0.9
    target.x -= 0.7

    meshRef.current.position.copy(target)
    meshRef.current.lookAt(camera.position)
  })

  if (!isPresenting) return null

  return (
    <mesh ref={meshRef} renderOrder={9999}>
      <planeGeometry args={[1.2, 0.6]} />
      <meshBasicMaterial
        map={textureRef.current}
        transparent
        opacity={0.92}
        depthTest={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
