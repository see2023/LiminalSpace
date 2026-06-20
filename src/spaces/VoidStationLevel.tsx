import { useState, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Portal } from './Portal'
import { VS_CELL as CELL_SIZE, VS_PLATFORM as PLATFORM_SIZE, VS_CORRIDOR_W as CORRIDOR_WIDTH, getVoidCellData } from '../utils/collision'

const RAILING_HEIGHT = 0.9
const RENDER_RADIUS = 3
const LEVELS_Y = 3

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 4294967296
  }
}

const globalNetTexture = (() => {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = 'rgba(150, 220, 255, 0.4)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 0); ctx.lineTo(64, 64)
  ctx.moveTo(64, 0); ctx.lineTo(0, 64)
  ctx.stroke()
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
})()

function FlowingLight({ length, color, offsetPos }: { length: number; color: string; offsetPos: [number, number, number] }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  const tex = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 16; canvas.height = 256
    const ctx = canvas.getContext('2d')!
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.5, 'rgba(255,255,255,1)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 16, 256)
    const t = new THREE.CanvasTexture(canvas)
    t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1, length / 2)
    return t
  }, [length])

  useFrame((_, delta) => {
    if (matRef.current && matRef.current.map) {
      matRef.current.map.offset.y -= delta * 1.5
    }
  })

  return (
    <mesh position={offsetPos} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.1, length]} />
      <meshBasicMaterial ref={matRef} map={tex} color={color} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  )
}

function SectorSign({ gx, gy, gz, axis }: { gx: number; gy: number; gz: number; axis: string }) {
  const tex = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgba(5, 10, 20, 0.85)'
    ctx.fillRect(0, 0, 256, 128)
    ctx.strokeStyle = '#00ffff'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, 252, 124)
    ctx.fillStyle = '#00ffff'
    ctx.font = 'bold 36px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`SEC ${gx > 0 ? 'E' : 'W'}${Math.abs(gx)}`, 128, 50)
    ctx.font = '24px monospace'
    ctx.fillText(`LINK ${axis.toUpperCase()}`, 128, 90)
    return new THREE.CanvasTexture(canvas)
  }, [gx, axis])

  return (
    <group position={[-CORRIDOR_WIDTH / 2, RAILING_HEIGHT + 0.4, 0]}>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.2, 0.6]} />
        <meshBasicMaterial map={tex} transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}

function Corridor({ start, length, axis, hue, gx, gy, gz }: { start: number; length: number; axis: 'x' | 'z'; hue: number; gx: number; gy: number; gz: number }) {
  const halfLen = length / 2
  const halfW = CORRIDOR_WIDTH / 2
  const emissive = `hsl(${hue}, 75%, 30%)`
  const bright = `hsl(${hue}, 90%, 50%)`

  const cx = axis === 'x' ? start + halfLen : 0
  const cz = axis === 'z' ? start + halfLen : 0
  const rotY = axis === 'x' ? Math.PI / 2 : 0

  const netTex = useMemo(() => {
    const t = globalNetTexture.clone()
    t.needsUpdate = true
    t.repeat.set(length * 1.5, RAILING_HEIGHT * 1.5)
    return t
  }, [length])

  return (
    <group position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
      {/* Floor */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[CORRIDOR_WIDTH, 0.18, length]} />
        <meshStandardMaterial color={`hsl(${hue}, 40%, 10%)`} emissive={emissive} emissiveIntensity={0.3} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Top panel glow - makes corridor clearly visible on Pico */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[CORRIDOR_WIDTH * 0.92, 0.03, length * 0.98]} />
        <meshBasicMaterial color={bright} transparent opacity={0.15} />
      </mesh>

      {/* Flowing Edge Lights */}
      <FlowingLight length={length} color={bright} offsetPos={[-halfW + 0.15, 0.14, 0]} />
      <FlowingLight length={length} color={bright} offsetPos={[halfW - 0.15, 0.14, 0]} />

      {/* Safety Nets */}
      <mesh position={[-halfW, RAILING_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[length, RAILING_HEIGHT]} />
        <meshBasicMaterial map={netTex} color={emissive} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[halfW, RAILING_HEIGHT / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[length, RAILING_HEIGHT]} />
        <meshBasicMaterial map={netTex} color={emissive} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Top Railing Bars */}
      <mesh position={[-halfW, RAILING_HEIGHT, 0]}>
        <boxGeometry args={[0.06, 0.06, length]} />
        <meshStandardMaterial color="#1a1a2e" emissive={emissive} emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[halfW, RAILING_HEIGHT, 0]}>
        <boxGeometry args={[0.06, 0.06, length]} />
        <meshStandardMaterial color="#1a1a2e" emissive={emissive} emissiveIntensity={0.8} />
      </mesh>

      {/* Railing posts */}
      {[-0.4, 0, 0.4].map((t, i) => (
        <group key={i} position={[0, RAILING_HEIGHT / 2, t * length]}>
          <mesh position={[-halfW, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, RAILING_HEIGHT, 4]} />
            <meshBasicMaterial color={emissive} transparent opacity={0.7} />
          </mesh>
          <mesh position={[halfW, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, RAILING_HEIGHT, 4]} />
            <meshBasicMaterial color={emissive} transparent opacity={0.7} />
          </mesh>
        </group>
      ))}

      <SectorSign gx={gx} gy={gy} gz={gz} axis={axis} />
    </group>
  )
}

function ElevatorPad({ type }: { type: 'up' | 'down' }) {
  const isUp = type === 'up'
  const color = isUp ? '#00ff88' : '#b040ff'
  const pos: [number, number, number] = isUp ? [1.2, 0.15, 1.2] : [-1.2, 0.15, -1.2]

  const tex = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = color
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(64, 64, 50, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 32px sans-serif'
    ctx.fillText(isUp ? '▲' : '▼', 64, 64)
    return new THREE.CanvasTexture(canvas)
  }, [isUp, color])

  return (
    <group position={pos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 32]} />
        <meshBasicMaterial map={tex} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 2, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function PlatformCell({ gx, gy, gz }: { gx: number; gy: number; gz: number }) {
  const cell = useMemo(() => getVoidCellData(gx, gy, gz), [gx, gy, gz])
  const neighborX = useMemo(() => getVoidCellData(gx + 1, gy, gz), [gx, gy, gz])
  const neighborZ = useMemo(() => getVoidCellData(gx, gy, gz + 1), [gx, gy, gz])
  const neighborYUp = useMemo(() => getVoidCellData(gx, gy + 1, gz), [gx, gy, gz])
  const neighborYDown = useMemo(() => getVoidCellData(gx, gy - 1, gz), [gx, gy, gz])
  const cellBelow = useMemo(() => getVoidCellData(gx, gy - 1, gz), [gx, gy, gz])

  if (!cell.exists) return null

  const wx = gx * CELL_SIZE
  const wy = gy * CELL_SIZE
  const wz = gz * CELL_SIZE
  const emissive = `hsl(${cell.hue}, 75%, 30%)`
  const platformColor = `hsl(${cell.hue}, 40%, 8%)`
  const brightEmissive = `hsl(${cell.hue}, 90%, 50%)`

  const hasElevatorUp = cell.connectY && neighborYUp.exists
  const hasElevatorDown = cellBelow.connectY && cellBelow.exists

  return (
    <group position={[wx, wy, wz]}>
      {/* Platform main surface */}
      <mesh receiveShadow>
        <boxGeometry args={[PLATFORM_SIZE, 0.25, PLATFORM_SIZE]} />
        <meshStandardMaterial color={platformColor} emissive={emissive} emissiveIntensity={0.3} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Platform grid pattern (cross on top) */}
      <mesh position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PLATFORM_SIZE - 0.2, PLATFORM_SIZE - 0.2]} />
        <meshBasicMaterial color={brightEmissive} transparent opacity={0.08} />
      </mesh>
      {/* Underside glow strip */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[PLATFORM_SIZE * 0.8, 0.04, PLATFORM_SIZE * 0.8]} />
        <meshBasicMaterial color={brightEmissive} transparent opacity={0.4} />
      </mesh>

      {/* Platform center decal */}
      <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 1.3, 32]} />
        <meshBasicMaterial color={brightEmissive} transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 16]} />
        <meshBasicMaterial color={brightEmissive} transparent opacity={0.2} />
      </mesh>

      {/* Elevators */}
      {hasElevatorUp && <ElevatorPad type="up" />}
      {hasElevatorDown && <ElevatorPad type="down" />}

      {/* Corridor +X */}
      {cell.connectX && neighborX.exists && (
        <Corridor start={PLATFORM_SIZE / 2} length={CELL_SIZE - PLATFORM_SIZE} axis="x" hue={cell.hue} gx={gx} gy={gy} gz={gz} />
      )}
      {/* Corridor +Z */}
      {cell.connectZ && neighborZ.exists && (
        <Corridor start={PLATFORM_SIZE / 2} length={CELL_SIZE - PLATFORM_SIZE} axis="z" hue={cell.hue} gx={gx} gy={gy} gz={gz} />
      )}
    </group>
  )
}

function Nebula({ position, radius, color, speed, count = 80 }: {
  position: [number, number, number]; radius: number; color: string; speed: number; count?: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const geo = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const rand = seededRandom(position[0] * 1000 + position[1] * 100 + position[2])
    for (let i = 0; i < count; i++) {
      const r = rand() * radius
      const theta = rand() * Math.PI * 2
      const phi = Math.acos(2 * rand() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.4
      positions[i * 3 + 2] = r * Math.cos(phi)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [position, radius, count])

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += speed * delta
  })

  return (
    <group ref={groupRef} position={position}>
      <points geometry={geo}>
        <pointsMaterial color={color} size={1.2} transparent opacity={0.35} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
    </group>
  )
}

function Galaxy({ position, radius, color, tilt, speed, stars = 400 }: {
  position: [number, number, number]; radius: number; color: string; tilt: [number, number, number]; speed: number; stars?: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const geo = useMemo(() => {
    const positions = new Float32Array(stars * 3)
    const colors = new Float32Array(stars * 3)
    const rand = seededRandom(position[0] * 999 + position[2] * 777)
    const col = new THREE.Color(color)
    for (let i = 0; i < stars; i++) {
      const angle = rand() * Math.PI * 2
      const arm = Math.floor(rand() * 3)
      const armAngle = angle + (arm * Math.PI * 2) / 3
      const dist = rand() * radius
      const finalAngle = armAngle + dist * 0.25
      const scatter = (rand() - 0.5) * radius * 0.12
      positions[i * 3] = Math.cos(finalAngle) * dist + scatter
      positions[i * 3 + 1] = (rand() - 0.5) * radius * 0.04
      positions[i * 3 + 2] = Math.sin(finalAngle) * dist + scatter
      const b = 0.4 + rand() * 0.6
      colors[i * 3] = col.r * b
      colors[i * 3 + 1] = col.g * b
      colors[i * 3 + 2] = col.b * b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [position, radius, color, stars])

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += speed * delta
  })

  return (
    <group ref={groupRef} position={position} rotation={tilt}>
      <points geometry={geo}>
        <pointsMaterial size={0.35} vertexColors transparent opacity={0.8} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
    </group>
  )
}

function BackgroundStars() {
  const geo = useMemo(() => {
    const count = 2000
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const rand = seededRandom(42)
    for (let i = 0; i < count; i++) {
      const r = 80 + rand() * 40
      const theta = rand() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
      const b = 0.2 + rand() * 0.8
      colors[i * 3] = b * 0.9
      colors[i * 3 + 1] = b * 0.95
      colors[i * 3 + 2] = b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [])

  return (
    <points geometry={geo}>
      <pointsMaterial size={0.12} vertexColors transparent opacity={0.7} sizeAttenuation depthWrite={false} />
    </points>
  )
}

export function VoidStationLevel() {
  const { camera } = useThree()
  const [gridPos, setGridPos] = useState([0, 0, 0])
  const lastCheck = useRef(0)

  useFrame(() => {
    const now = performance.now()
    if (now - lastCheck.current < 300) return
    lastCheck.current = now

    const camWorld = new THREE.Vector3()
    camera.getWorldPosition(camWorld)
    const cgx = Math.round(camWorld.x / CELL_SIZE)
    const cgy = Math.round(camWorld.y / CELL_SIZE)
    const cgz = Math.round(camWorld.z / CELL_SIZE)

    if (cgx !== gridPos[0] || cgy !== gridPos[1] || cgz !== gridPos[2]) {
      setGridPos([cgx, cgy, cgz])
    }
  })

  const visibleCells = useMemo(() => {
    const cells: { gx: number; gy: number; gz: number }[] = []
    const [cgx, cgy, cgz] = gridPos
    for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
      for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
        for (let dy = -1; dy <= LEVELS_Y - 1; dy++) {
          if (dx * dx + dz * dz <= RENDER_RADIUS * RENDER_RADIUS) {
            cells.push({ gx: cgx + dx, gy: cgy + dy, gz: cgz + dz })
          }
        }
      }
    }
    return cells
  }, [gridPos])

  return (
    <>
      <color attach="background" args={['#010108']} />
      <fog attach="fog" args={['#010108', 35, 90]} />
      <ambientLight color="#181830" intensity={0.5} />

      {/* Nebulae - large, distant */}
      <Nebula position={[70, 25, -50]} radius={18} color="#ff2060" speed={0.04} count={100} />
      <Nebula position={[-60, -15, 70]} radius={14} color="#2060ff" speed={-0.03} count={80} />
      <Nebula position={[40, 45, 55]} radius={12} color="#20ff80" speed={0.035} count={70} />
      <Nebula position={[-80, 35, -40]} radius={20} color="#ff6020" speed={-0.025} count={120} />

      {/* Galaxies */}
      <Galaxy position={[90, 35, 90]} radius={22} color="#ffe0a0" tilt={[0.5, 0, 0.3]} speed={0.06} stars={500} />
      <Galaxy position={[-70, 55, -90]} radius={28} color="#a0c0ff" tilt={[-0.3, 0, 0.6]} speed={-0.04} stars={600} />
      <Galaxy position={[50, -35, -100]} radius={18} color="#ffa0e0" tilt={[0.8, 0, -0.2]} speed={0.05} stars={400} />

      <BackgroundStars />

      {/* Platforms */}
      {visibleCells.map((c) => (
        <PlatformCell key={`${c.gx}_${c.gy}_${c.gz}`} gx={c.gx} gy={c.gy} gz={c.gz} />
      ))}

      {/* Portals - placed 3 cells away from origin so player has room to explore */}
      <Portal position={[CELL_SIZE * 3, 0.15, 0]} targetLevel="backrooms" label="Backrooms" color="#f0d060" />
      <Portal position={[0, 0.15, CELL_SIZE * 3]} targetLevel="poolrooms" label="Pool Rooms" color="#40c8ff" />
    </>
  )
}
