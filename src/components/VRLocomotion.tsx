import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { XROrigin, useXR } from '@react-three/xr'
import * as THREE from 'three'
import { damp, damp2, damp3 } from 'maath/easing'
import { useGameStore } from '../store/gameStore'
import type { LevelType } from '../store/gameStore'
import { APP_VERSION } from '../version'
import { isWallAt, isVoidWalkable, getVoidCellData, getPoolFloorHeight, isPoolWall, VS_CELL, PLAYER_RADIUS } from '../utils/collision'

const VR_MOVE_SPEED = 5
const SWIM_SPEED = 4
const SWIM_THRESHOLD = 0.3
const DEADZONE = 0.15
const INPUT_DAMP = 0.12
const VELOCITY_DAMP = 0.14
const TURN_DAMP = 0.12
const VOID_Y_DAMP = 0.22
const ELEVATOR_COOLDOWN = 0.35

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

  const prevLeftPos = useRef(new THREE.Vector3())
  const prevRightPos = useRef(new THREE.Vector3())
  const swimVel = useRef(new THREE.Vector3())
  const initialized = useRef(false)
  const _dir = useRef(new THREE.Vector3())
  const _right = useRef(new THREE.Vector3())
  const _up = useRef(new THREE.Vector3(0, 1, 0))
  const logTimer = useRef(0)
  const didLogOnce = useRef(false)
  const poseErrorLoggedAt = useRef(0)
  const smoothedInput = useRef(new THREE.Vector2(0, 0)) // x: strafe, y: fwd
  const smoothedTurn = useRef(0)
  const turnState = useRef({ value: 0 })
  const worldVelocity = useRef(new THREE.Vector3())
  const desiredVelocity = useRef(new THREE.Vector3())
  const voidTargetY = useRef(0)
  const elevatorCd = useRef(0)

  useEffect(() => {
    if (!originRef.current) return
    if (currentLevel === 'backrooms') {
      originRef.current.position.set(6, 0, 6)
      voidTargetY.current = 0
    } else if (currentLevel === 'poolrooms') {
      originRef.current.position.set(-32.5, 0.2, -32.5) // Walkway height is 0.2
      voidTargetY.current = 0.2
    } else if (currentLevel === 'voidstation') {
      originRef.current.position.set(0, 0, 0)
      voidTargetY.current = 0
      elevatorCd.current = 0
    }
  }, [currentLevel])

  useFrame(({ camera, gl }, delta) => {
    if (!gl.xr.isPresenting) return
    if (elevatorCd.current > 0) elevatorCd.current -= delta

    const session = gl.xr.getSession()

    logTimer.current += delta
    if (logTimer.current > 3 && !didLogOnce.current) {
      didLogOnce.current = true
      const sources = session?.inputSources
      const hasLeft = !!sources && Array.from(sources).some((s) => s.handedness === 'left')
      const hasRight = !!sources && Array.from(sources).some((s) => s.handedness === 'right')
      const info = sources
        ? Array.from(sources).map(s => `${s.handedness}:profiles=[${s.profiles.join(',')}],axes=${s.gamepad?.axes.length ?? 'none'}`).join(' | ')
        : 'no session'
      sendLog('info', `[VRLoco] controllers: left=${hasLeft} right=${hasRight} | sources: ${info}`)
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

      damp2(smoothedInput.current, [strafe, fwd], INPUT_DAMP, delta)
      damp(turnState.current, 'value', turn, TURN_DAMP, delta)
      smoothedTurn.current = turnState.current.value

      if (Math.abs(smoothedInput.current.y) > 0.01 || Math.abs(smoothedInput.current.x) > 0.01 || worldVelocity.current.lengthSq() > 0.00001) {
        camera.getWorldDirection(_dir.current)
        _dir.current.y = 0
        _dir.current.normalize()
        _right.current.crossVectors(_dir.current, _up.current).normalize()

        desiredVelocity.current.set(0, 0, 0)
        desiredVelocity.current.addScaledVector(_dir.current, smoothedInput.current.y)
        desiredVelocity.current.addScaledVector(_right.current, smoothedInput.current.x)
        if (desiredVelocity.current.lengthSq() > 0.0001) {
          desiredVelocity.current.normalize().multiplyScalar(VR_MOVE_SPEED)
        }
        damp3(worldVelocity.current, desiredVelocity.current, VELOCITY_DAMP, delta)

        const moveX = worldVelocity.current.x * delta
        const moveZ = worldVelocity.current.z * delta

        const camWorld = new THREE.Vector3()
        camera.getWorldPosition(camWorld)
        const newX = camWorld.x + moveX
        const newZ = camWorld.z + moveZ

        let blockXZ = false

        if (currentLevel === 'voidstation') {
          const gy = Math.round(voidTargetY.current / VS_CELL)
          const gx = Math.round(camWorld.x / VS_CELL)
          const gz = Math.round(camWorld.z / VS_CELL)
          const lx = camWorld.x - gx * VS_CELL
          const lz = camWorld.z - gz * VS_CELL

          const cell = getVoidCellData(gx, gy, gz)
          const cellAbove = getVoidCellData(gx, gy + 1, gz)
          const cellBelow = getVoidCellData(gx, gy - 1, gz)

          const canGoUp = cell.connectY && cellAbove.exists
          const canGoDown = cellBelow.connectY && cellBelow.exists

          if (elevatorCd.current <= 0 && canGoUp && Math.hypot(lx - 1.2, lz - 1.2) < 0.7) {
            voidTargetY.current = (gy + 1) * VS_CELL
            elevatorCd.current = ELEVATOR_COOLDOWN
          } else if (elevatorCd.current <= 0 && canGoDown && Math.hypot(lx - (-1.2), lz - (-1.2)) < 0.7) {
            voidTargetY.current = (gy - 1) * VS_CELL
            elevatorCd.current = ELEVATOR_COOLDOWN
          }

          damp(originRef.current.position, 'y', voidTargetY.current, VOID_Y_DAMP, delta)

          if (Math.abs(originRef.current.position.y - voidTargetY.current) > 0.08) {
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
        const gy = Math.round(voidTargetY.current / VS_CELL)
        const gx = Math.round(camWorld.x / VS_CELL)
        const gz = Math.round(camWorld.z / VS_CELL)
        const lx = camWorld.x - gx * VS_CELL
        const lz = camWorld.z - gz * VS_CELL

        const cell = getVoidCellData(gx, gy, gz)
        const cellAbove = getVoidCellData(gx, gy + 1, gz)
        const cellBelow = getVoidCellData(gx, gy - 1, gz)

        const canGoUp = cell.connectY && cellAbove.exists
        const canGoDown = cellBelow.connectY && cellBelow.exists

        if (elevatorCd.current <= 0 && canGoUp && Math.hypot(lx - 1.2, lz - 1.2) < 0.7) {
          voidTargetY.current = (gy + 1) * VS_CELL
          elevatorCd.current = ELEVATOR_COOLDOWN
        } else if (elevatorCd.current <= 0 && canGoDown && Math.hypot(lx - (-1.2), lz - (-1.2)) < 0.7) {
          voidTargetY.current = (gy - 1) * VS_CELL
          elevatorCd.current = ELEVATOR_COOLDOWN
        }

        damp(originRef.current.position, 'y', voidTargetY.current, VOID_Y_DAMP, delta)
      }

      if (Math.abs(smoothedTurn.current) > 0.01) {
        originRef.current.rotation.y -= smoothedTurn.current * 1.8 * delta
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

      const leftInput = session?.inputSources
        ? Array.from(session.inputSources).find((s) => s.handedness === 'left')
        : undefined
      const rightInput = session?.inputSources
        ? Array.from(session.inputSources).find((s) => s.handedness === 'right')
        : undefined

      if (leftInput?.gripSpace && rightInput?.gripSpace) {
        let leftPose: XRPose | null = null
        let rightPose: XRPose | null = null
        try {
          leftPose = frame.getPose(leftInput.gripSpace, refSpace) ?? null
          rightPose = frame.getPose(rightInput.gripSpace, refSpace) ?? null
        } catch (err) {
          // Pico / WebXR occasionally throws session mismatch during/after XR state transitions.
          // Swallowing this frame prevents a hard crash/freeze of the render loop.
          const now = performance.now()
          if (now - poseErrorLoggedAt.current > 5000) {
            poseErrorLoggedAt.current = now
            const message = err instanceof Error ? err.message : String(err)
            sendLog('warn', `[VRLoco] getPose skipped: ${message}`)
          }
        }

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
