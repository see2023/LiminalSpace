import { useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { damp, damp2, damp3 } from 'maath/easing'
import { useGameStore, getEffectiveInputMode } from '../store/gameStore'
import { mobileInput } from '../store/inputState'
import { isWallAt, isVoidWalkable, getVoidCellData, getPoolFloorHeight, isPoolWall, VS_CELL, PLAYER_RADIUS } from '../utils/collision'

const MOVE_SPEED = 4.5
const PLAYER_HEIGHT = 1.6
const INPUT_DAMP = 0.12
const VELOCITY_DAMP = 0.14
const VOID_Y_DAMP = 0.22
const ELEVATOR_COOLDOWN = 0.35

export function FPSControls() {
  const { camera, gl } = useThree()
  const keysRef = useRef(new Set<string>())
  const isLockedRef = useRef(false)
  const eulerRef = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const started = useGameStore((s) => s.started)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const transitioning = useGameStore((s) => s.transitioning)

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isLockedRef.current) return
    const euler = eulerRef.current
    euler.setFromQuaternion(camera.quaternion)
    euler.y -= e.movementX * 0.002
    euler.x -= e.movementY * 0.002
    euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x))
    camera.quaternion.setFromEuler(euler)
  }, [camera])

  useEffect(() => {
    const canvas = gl.domElement

    const onLockChange = () => {
      isLockedRef.current = document.pointerLockElement === canvas
    }

    const onKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.code)
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code)

    const onClick = () => {
      if (started && !isLockedRef.current && getEffectiveInputMode() === 'desktop') {
        canvas.requestPointerLock()
      }
    }

    document.addEventListener('pointerlockchange', onLockChange)
    document.addEventListener('mousemove', onMouseMove)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('click', onClick)

    return () => {
      document.removeEventListener('pointerlockchange', onLockChange)
      document.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('click', onClick)
    }
  }, [gl, onMouseMove, started])

  useEffect(() => {
    if (currentLevel === 'backrooms') {
      camera.position.set(6, PLAYER_HEIGHT, 6)
      _voidTargetY.current = PLAYER_HEIGHT
    } else if (currentLevel === 'poolrooms') {
      camera.position.set(-32.5, 2.0, -32.5) // Spawn on the dry walkway (Row 1, Col 1 of grid)
      _voidTargetY.current = 1.0
    } else if (currentLevel === 'voidstation') {
      camera.position.set(0, PLAYER_HEIGHT, 0)
      _voidTargetY.current = PLAYER_HEIGHT
      _elevatorCd.current = 0
    }
  }, [currentLevel, camera])

  const _moveDir = useRef(new THREE.Vector3())
  const _camDir = useRef(new THREE.Vector3())
  const _right = useRef(new THREE.Vector3())
  const _up = useRef(new THREE.Vector3(0, 1, 0))
  const _input = useRef(new THREE.Vector2(0, 0)) // x: strafe, y: fwd
  const _velocity = useRef(new THREE.Vector3())
  const _desiredVelocity = useRef(new THREE.Vector3())
  const _voidTargetY = useRef(PLAYER_HEIGHT)
  const _elevatorCd = useRef(0)

  useFrame((_, delta) => {
    if (!started || transitioning) return
    if (_elevatorCd.current > 0) _elevatorCd.current -= delta

    const mode = getEffectiveInputMode()
    let fwd = 0
    let strafe = 0

    if (mode === 'desktop') {
      if (!isLockedRef.current) return
      const keys = keysRef.current
      fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
      strafe = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)
    } else     if (mode === 'mobile') {
      if (mobileInput.lookX !== 0 || mobileInput.lookY !== 0) {
        const euler = eulerRef.current
        euler.setFromQuaternion(camera.quaternion)
        euler.y -= mobileInput.lookX * 0.003
        euler.x -= mobileInput.lookY * 0.003
        euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x))
        camera.quaternion.setFromEuler(euler)
        mobileInput.lookX = 0
        mobileInput.lookY = 0
      }

      fwd = mobileInput.moveY
      strafe = mobileInput.moveX

      // Also poll Gamepad API (for Pico controllers in non-VR browser mode)
      const gamepads = navigator.getGamepads?.()
      if (gamepads) {
        for (const gp of gamepads) {
          if (!gp) continue
          const lx = gp.axes[0] ?? 0
          const ly = gp.axes[1] ?? 0
          const rx = gp.axes[2] ?? 0
          const ry = gp.axes[3] ?? 0
          const deadzone = 0.15
          if (Math.abs(lx) > deadzone || Math.abs(ly) > deadzone) {
            strafe += lx
            fwd += -ly
          }
          if (Math.abs(rx) > deadzone || Math.abs(ry) > deadzone) {
            const euler = eulerRef.current
            euler.setFromQuaternion(camera.quaternion)
            euler.y -= rx * delta * 2.5
            euler.x -= ry * delta * 2.5
            euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x))
            camera.quaternion.setFromEuler(euler)
          }
        }
      }
    }

    let blockXZ = false

    if (currentLevel === 'voidstation') {
      const gy = Math.round((_voidTargetY.current - PLAYER_HEIGHT) / VS_CELL)
      const gx = Math.round(camera.position.x / VS_CELL)
      const gz = Math.round(camera.position.z / VS_CELL)
      const lx = camera.position.x - gx * VS_CELL
      const lz = camera.position.z - gz * VS_CELL

      const cell = getVoidCellData(gx, gy, gz)
      const cellAbove = getVoidCellData(gx, gy + 1, gz)
      const cellBelow = getVoidCellData(gx, gy - 1, gz)

      const canGoUp = cell.connectY && cellAbove.exists
      const canGoDown = cellBelow.connectY && cellBelow.exists

      if (_elevatorCd.current <= 0 && canGoUp && Math.hypot(lx - 1.2, lz - 1.2) < 0.7) {
        _voidTargetY.current = (gy + 1) * VS_CELL + PLAYER_HEIGHT
        _elevatorCd.current = ELEVATOR_COOLDOWN
      } else if (_elevatorCd.current <= 0 && canGoDown && Math.hypot(lx - (-1.2), lz - (-1.2)) < 0.7) {
        _voidTargetY.current = (gy - 1) * VS_CELL + PLAYER_HEIGHT
        _elevatorCd.current = ELEVATOR_COOLDOWN
      }

      damp(camera.position, 'y', _voidTargetY.current, VOID_Y_DAMP, delta)

      if (Math.abs(camera.position.y - _voidTargetY.current) > 0.08) {
        blockXZ = true
      }
    } else {
      _voidTargetY.current = currentLevel === 'poolrooms' ? 1.0 : PLAYER_HEIGHT
      camera.position.y = currentLevel === 'poolrooms' ? 1.0 : PLAYER_HEIGHT
    }

    const targetFwd = blockXZ ? 0 : fwd
    const targetStrafe = blockXZ ? 0 : strafe
    damp2(_input.current, [targetStrafe, targetFwd], INPUT_DAMP, delta)

    camera.getWorldDirection(_camDir.current)
    _camDir.current.y = 0
    _camDir.current.normalize()

    _right.current.crossVectors(_camDir.current, _up.current).normalize()

    _desiredVelocity.current.set(0, 0, 0)
    _desiredVelocity.current.addScaledVector(_camDir.current, _input.current.y)
    _desiredVelocity.current.addScaledVector(_right.current, _input.current.x)
    if (_desiredVelocity.current.lengthSq() > 0.0001) {
      _desiredVelocity.current.normalize().multiplyScalar(MOVE_SPEED)
    }

    damp3(_velocity.current, _desiredVelocity.current, VELOCITY_DAMP, delta)

    if (_velocity.current.lengthSq() < 0.00001 && Math.abs(targetFwd) < 0.05 && Math.abs(targetStrafe) < 0.05) {
      return
    }

    _moveDir.current.set(_velocity.current.x * delta, 0, _velocity.current.z * delta)

    const newX = camera.position.x + _moveDir.current.x
    const newZ = camera.position.z + _moveDir.current.z

    if (currentLevel === 'backrooms') {
      if (!isWallAt(newX + Math.sign(_moveDir.current.x) * PLAYER_RADIUS, camera.position.z)) {
        camera.position.x = newX
      }
      if (!isWallAt(camera.position.x, newZ + Math.sign(_moveDir.current.z) * PLAYER_RADIUS)) {
        camera.position.z = newZ
      }
    } else if (currentLevel === 'voidstation') {
      const testX = newX + Math.sign(_moveDir.current.x) * PLAYER_RADIUS
      const testZ = newZ + Math.sign(_moveDir.current.z) * PLAYER_RADIUS
      if (isVoidWalkable(testX, camera.position.y, camera.position.z)) {
        camera.position.x = newX
      }
      if (isVoidWalkable(camera.position.x, camera.position.y, testZ)) {
        camera.position.z = newZ
      }
    } else if (currentLevel === 'poolrooms') {
      const testX = newX + Math.sign(_moveDir.current.x) * PLAYER_RADIUS
      const testZ = newZ + Math.sign(_moveDir.current.z) * PLAYER_RADIUS
      if (!isPoolWall(testX, camera.position.z)) camera.position.x = newX
      if (!isPoolWall(camera.position.x, testZ)) camera.position.z = newZ
      
      const floorY = getPoolFloorHeight(camera.position.x, camera.position.z)
      // If floor is above water (walkway), walk normally. If below water, swim.
      // Water surface is at 0.
      let targetY = floorY + PLAYER_HEIGHT
      if (floorY < -1.0) {
        // Deep water swimming height
        targetY = 0.6 // Float at 0.6 (water is 0, head is above water)
      } else if (floorY < 0) {
        // Shallow water wading height
        targetY = floorY + PLAYER_HEIGHT
      }
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, delta * 12)
    } else {
      camera.position.x = newX
      camera.position.z = newZ
    }
  })

  return null
}
