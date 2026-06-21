import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const JELLYFISH_COUNT = 8
const FISH_PER_SCHOOL = 50
const TURTLE_COUNT = 3

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 4294967296
  }
}

function Jellyfish({ startPos, seed }: { startPos: [number, number, number]; seed: number }) {
  const meshRef = useRef<THREE.Group>(null)
  const phase = useRef(seed * Math.PI * 2)
  const pos = useRef(new THREE.Vector3(...startPos))
  const rand = useMemo(() => seededRandom(seed), [seed])
  const driftSpeed = useMemo(() => 0.2 + rand() * 0.3, [rand])
  const driftDir = useMemo(() => new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5).normalize(), [rand])
  const hue = useMemo(() => 170 + rand() * 80, [rand])
  const scale = useMemo(() => 0.25 + rand() * 0.45, [rand])

  useFrame((_, delta) => {
    phase.current += delta
    pos.current.addScaledVector(driftDir, driftSpeed * delta)
    pos.current.y = startPos[1] + Math.sin(phase.current * 0.6) * 0.4
    if (Math.abs(pos.current.x) > 35 || Math.abs(pos.current.z) > 35) driftDir.negate()
    if (meshRef.current) {
      meshRef.current.position.copy(pos.current)
      meshRef.current.rotation.y += delta * 0.2
      const pulse = 1.0 + Math.sin(phase.current * 2.0) * 0.2
      meshRef.current.scale.set(scale * pulse, scale * (1.0 - Math.sin(phase.current * 2.0) * 0.1), scale * pulse)
    }
  })

  const color = `hsl(${hue}, 80%, 65%)`
  const emissive = `hsl(${hue}, 90%, 45%)`

  return (
    <group ref={meshRef} position={startPos}>
      <mesh>
        <sphereGeometry args={[0.7, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <sphereGeometry args={[0.45, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
        <meshBasicMaterial color={emissive} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {[0, 1].map((i) => (
        <mesh key={`oral-${i}`} position={[(i - 0.5) * 0.15, -0.7, 0]}>
          <cylinderGeometry args={[0.04, 0.02, 0.9, 4]} />
          <meshBasicMaterial color={emissive} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.4, -1.1, Math.sin(angle) * 0.4]} rotation={[Math.sin(angle) * 0.2, 0, Math.cos(angle) * 0.2]}>
            <cylinderGeometry args={[0.015, 0.008, 1.4, 3]} />
            <meshBasicMaterial color={color} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        )
      })}
    </group>
  )
}

function createRealisticFishGeometry(colorTop: THREE.Color, colorBottom: THREE.Color, colorStripe: THREE.Color): THREE.BufferGeometry {
  // Lathe-style fish body using custom vertices
  const segments = 12
  const rings = 16
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  // Fish body profile (cross-section radius at each ring along length)
  // nose -> fattest at 30% -> tail
  const bodyProfile = (t: number): number => {
    if (t < 0.3) return Math.sin((t / 0.3) * Math.PI * 0.5) * 0.32
    return Math.sin(((1 - t) / 0.7) * Math.PI * 0.5) * 0.32
  }

  // Height profile (slightly taller than wide in mid-body)
  const heightProfile = (t: number): number => {
    return bodyProfile(t) * 1.3
  }

  for (let r = 0; r <= rings; r++) {
    const t = r / rings
    const x = (t - 0.5) * 2.0 // -1 to 1
    const radius = bodyProfile(t)
    const height = heightProfile(t)

    for (let s = 0; s <= segments; s++) {
      const angle = (s / segments) * Math.PI * 2
      const py = Math.sin(angle) * height
      const pz = Math.cos(angle) * radius

      positions.push(x, py, pz)

      // Vertex coloring: top is dark, bottom is light, mid has stripe
      const normalizedY = (Math.sin(angle) + 1) * 0.5 // 0=bottom, 1=top
      let color: THREE.Color
      if (normalizedY > 0.7) {
        color = colorTop.clone()
      } else if (normalizedY > 0.4 && normalizedY < 0.6) {
        color = colorStripe.clone()
      } else {
        color = colorBottom.clone().lerp(colorStripe, normalizedY * 1.5)
      }
      colors.push(color.r, color.g, color.b)
    }
  }

  // Indices
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * (segments + 1) + s
      const b = a + segments + 1
      indices.push(a, b, a + 1)
      indices.push(b, b + 1, a + 1)
    }
  }

  // Tail fin (triangle fan)
  const tailBase = positions.length / 3
  // Center of tail
  positions.push(-1.0, 0, 0)
  colors.push(colorTop.r * 0.7, colorTop.g * 0.7, colorTop.b * 0.7)
  // Upper lobe
  positions.push(-1.35, 0.25, 0)
  colors.push(colorTop.r * 0.5, colorTop.g * 0.5, colorTop.b * 0.5)
  // Lower lobe
  positions.push(-1.35, -0.25, 0)
  colors.push(colorTop.r * 0.5, colorTop.g * 0.5, colorTop.b * 0.5)
  // Tip
  positions.push(-1.5, 0, 0)
  colors.push(colorStripe.r, colorStripe.g, colorStripe.b)

  indices.push(tailBase, tailBase + 1, tailBase + 3)
  indices.push(tailBase, tailBase + 3, tailBase + 2)

  // Dorsal fin
  const dorsalBase = positions.length / 3
  positions.push(0.1, 0.32, 0)
  colors.push(colorTop.r, colorTop.g, colorTop.b)
  positions.push(-0.3, 0.28, 0)
  colors.push(colorTop.r * 0.8, colorTop.g * 0.8, colorTop.b * 0.8)
  positions.push(-0.1, 0.5, 0)
  colors.push(colorStripe.r, colorStripe.g, colorStripe.b)
  indices.push(dorsalBase, dorsalBase + 1, dorsalBase + 2)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

interface FishState { pos: THREE.Vector3; vel: THREE.Vector3; phase: number }

function FishSchool({ center, seed, count, topColor, bottomColor, stripeColor }: {
  center: THREE.Vector3; seed: number; count: number
  topColor: string; bottomColor: string; stripeColor: string
}) {
  const fishRef = useRef<THREE.InstancedMesh>(null)
  const fishStates = useRef<FishState[]>([])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const { camera } = useThree()

  useMemo(() => {
    const r = seededRandom(seed + 1000)
    fishStates.current = Array.from({ length: count }, () => ({
      pos: new THREE.Vector3(center.x + (r() - 0.5) * 10, center.y + (r() - 0.5) * 2, center.z + (r() - 0.5) * 10),
      vel: new THREE.Vector3((r() - 0.5) * 2, 0, (r() - 0.5) * 2).normalize().multiplyScalar(1.5 + r() * 1.5),
      phase: r() * Math.PI * 2,
    }))
  }, [center, seed, count])

  const fishGeo = useMemo(() => createRealisticFishGeometry(
    new THREE.Color(topColor),
    new THREE.Color(bottomColor),
    new THREE.Color(stripeColor)
  ), [topColor, bottomColor, stripeColor])

  useFrame((_, delta) => {
    if (!fishRef.current) return
    const camPos = camera.position
    const schoolCenter = new THREE.Vector3(
      THREE.MathUtils.lerp(center.x, camPos.x, 0.008),
      center.y,
      THREE.MathUtils.lerp(center.z, camPos.z, 0.008)
    )
    center.copy(schoolCenter)

    for (let i = 0; i < count; i++) {
      const f = fishStates.current[i]
      f.phase += delta * (2.5 + (i % 7) * 0.1)

      const toCenter = schoolCenter.clone().sub(f.pos)
      if (toCenter.lengthSq() > 36) f.vel.addScaledVector(toCenter.normalize(), delta * 3.5)

      // Separation
      if (i < count - 1) {
        const next = fishStates.current[(i + 1) % count]
        const diff = f.pos.clone().sub(next.pos)
        if (diff.lengthSq() < 0.8) f.vel.addScaledVector(diff.normalize(), delta * 3)
      }

      f.vel.x += Math.sin(f.phase * 0.9 + i * 0.5) * delta * 0.4
      f.vel.z += Math.cos(f.phase * 0.7 + i * 0.3) * delta * 0.4
      f.vel.y += Math.sin(f.phase * 1.2) * delta * 0.6
      // Clamp vertical velocity
      f.vel.y = THREE.MathUtils.clamp(f.vel.y, -0.5, 0.5)

      const speed = f.vel.length()
      if (speed > 3.5) f.vel.multiplyScalar(3.5 / speed)
      if (speed < 0.8) f.vel.normalize().multiplyScalar(0.8)
      f.pos.addScaledVector(f.vel, delta)

      // Keep fish underwater (below water surface at 0.3, with margin)
      if (f.pos.y > -0.2) { f.pos.y = -0.2; f.vel.y = -Math.abs(f.vel.y) }
      if (f.pos.y < -3.5) { f.pos.y = -3.5; f.vel.y = Math.abs(f.vel.y) }

      // Rotation: fish geometry faces +X, so use atan2(vel.z, vel.x) for heading
      const headingY = -Math.atan2(f.vel.z, f.vel.x)
      // Pitch: nose up/down based on vertical velocity
      const pitch = Math.atan2(f.vel.y, Math.sqrt(f.vel.x ** 2 + f.vel.z ** 2))
      // Tail wiggle as slight yaw oscillation
      const wiggleY = Math.sin(f.phase * 6) * 0.1

      dummy.position.copy(f.pos)
      dummy.rotation.set(0, 0, 0)
      dummy.rotation.y = headingY + wiggleY
      dummy.rotation.z = -pitch * 0.6
      dummy.scale.setScalar(0.15)
      dummy.updateMatrix()
      fishRef.current.setMatrixAt(i, dummy.matrix)
    }
    fishRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={fishRef} args={[fishGeo, undefined, count]}>
      <meshStandardMaterial vertexColors roughness={0.4} metalness={0.2} envMapIntensity={0.5} />
    </instancedMesh>
  )
}

interface TurtleState { pos: THREE.Vector3; vel: THREE.Vector3; phase: number }

function SeaTurtle({ startPos, seed }: { startPos: [number, number, number]; seed: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const flipperLRef = useRef<THREE.Mesh>(null)
  const flipperRRef = useRef<THREE.Mesh>(null)
  const state = useRef<TurtleState>({
    pos: new THREE.Vector3(...startPos),
    vel: new THREE.Vector3(0.3, 0, 0.2),
    phase: seed,
  })

  useFrame((_, delta) => {
    const s = state.current
    s.phase += delta
    s.vel.x += Math.sin(s.phase * 0.3) * delta * 0.1
    s.vel.z += Math.cos(s.phase * 0.25) * delta * 0.1
    s.vel.y = Math.sin(s.phase * 0.4) * 0.15
    const speed = s.vel.length()
    if (speed > 0.8) s.vel.multiplyScalar(0.8 / speed)
    s.pos.addScaledVector(s.vel, delta)
    if (Math.abs(s.pos.x) > 30 || Math.abs(s.pos.z) > 30) { s.vel.x *= -1; s.vel.z *= -1 }
    if (groupRef.current) {
      groupRef.current.position.copy(s.pos)
      groupRef.current.rotation.y = Math.atan2(s.vel.x, s.vel.z)
      groupRef.current.rotation.x = Math.atan2(-s.vel.y, 0.5) * 0.3
    }
    const flipAngle = Math.sin(s.phase * 2.5) * 0.6
    if (flipperLRef.current) flipperLRef.current.rotation.z = -0.3 + flipAngle
    if (flipperRRef.current) flipperRRef.current.rotation.z = 0.3 - flipAngle
  })

  return (
    <group ref={groupRef} position={startPos} scale={0.6}>
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.7, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color="#3a6630" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.05, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[0.55, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
        <meshStandardMaterial color="#8aa840" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.7]}>
        <sphereGeometry args={[0.2, 6, 5]} />
        <meshStandardMaterial color="#4a7a40" roughness={0.5} />
      </mesh>
      <mesh ref={flipperLRef} position={[-0.6, 0, 0.15]}>
        <boxGeometry args={[0.7, 0.06, 0.25]} />
        <meshStandardMaterial color="#4a7a40" roughness={0.5} />
      </mesh>
      <mesh ref={flipperRRef} position={[0.6, 0, 0.15]}>
        <boxGeometry args={[0.7, 0.06, 0.25]} />
        <meshStandardMaterial color="#4a7a40" roughness={0.5} />
      </mesh>
    </group>
  )
}

export function PoolCreatures() {
  const jellyPositions = useMemo(() => {
    const rand = seededRandom(42)
    return Array.from({ length: JELLYFISH_COUNT }, (): [number, number, number] => [
      (rand() - 0.5) * 45, -0.5 - rand() * 2.0, (rand() - 0.5) * 45,
    ])
  }, [])

  const schools = useMemo(() => [
    { center: new THREE.Vector3(-10, -1.2, -8), seed: 100, topColor: '#1a4080', bottomColor: '#c0d8e8', stripeColor: '#4090c0' },
    { center: new THREE.Vector3(12, -1.0, 5), seed: 200, topColor: '#804020', bottomColor: '#f0d8b0', stripeColor: '#f09030' },
    { center: new THREE.Vector3(-5, -1.5, 15), seed: 300, topColor: '#206040', bottomColor: '#b0e8c0', stripeColor: '#40c060' },
    { center: new THREE.Vector3(8, -0.8, -12), seed: 400, topColor: '#602060', bottomColor: '#e0c0e0', stripeColor: '#c040c0' },
  ], [])

  const turtlePositions = useMemo(() => {
    const rand = seededRandom(500)
    return Array.from({ length: TURTLE_COUNT }, (): [number, number, number] => [
      (rand() - 0.5) * 30, -0.8 - rand() * 1.0, (rand() - 0.5) * 30,
    ])
  }, [])

  return (
    <>
      {jellyPositions.map((pos, i) => (
        <Jellyfish key={`j-${i}`} startPos={pos} seed={i * 137 + 31} />
      ))}
      {schools.map((s, i) => (
        <FishSchool key={`f-${i}`} center={s.center} seed={s.seed} count={FISH_PER_SCHOOL} topColor={s.topColor} bottomColor={s.bottomColor} stripeColor={s.stripeColor} />
      ))}
      {turtlePositions.map((pos, i) => (
        <SeaTurtle key={`t-${i}`} startPos={pos} seed={i * 53 + 7} />
      ))}
    </>
  )
}
