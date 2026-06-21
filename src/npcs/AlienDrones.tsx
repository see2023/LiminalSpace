import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const SHIP_COUNT = 4
const WALKER_COUNT = 5

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 4294967296
  }
}

function mergeGeos(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0, totalIndices = 0
  for (const g of geometries) {
    totalVerts += g.attributes.position.count
    totalIndices += g.index ? g.index.count : g.attributes.position.count
  }
  const positions = new Float32Array(totalVerts * 3)
  const indices = new Uint32Array(totalIndices)
  let vertOffset = 0, idxOffset = 0, baseVertex = 0
  for (const g of geometries) {
    const pos = g.attributes.position
    for (let i = 0; i < pos.count * 3; i++) positions[vertOffset + i] = (pos.array as Float32Array)[i]
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) indices[idxOffset + i] = g.index.array[i] + baseVertex
      idxOffset += g.index.count
    } else {
      for (let i = 0; i < pos.count; i++) indices[idxOffset + i] = i + baseVertex
      idxOffset += pos.count
    }
    vertOffset += pos.count * 3
    baseVertex += pos.count
  }
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  merged.setIndex(new THREE.BufferAttribute(indices, 1))
  merged.computeVertexNormals()
  return merged
}

function createShipGeometry(): THREE.BufferGeometry {
  const group = new THREE.Group()
  // Fuselage - elongated
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 2.5, 8))
  hull.rotation.z = Math.PI / 2
  group.add(hull)
  // Nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.8, 8))
  nose.rotation.z = -Math.PI / 2
  nose.position.x = 1.6
  group.add(nose)
  // Cockpit window
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5))
  cockpit.position.set(0.8, 0.2, 0)
  group.add(cockpit)
  // Left wing
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 1.6))
  wingL.position.set(-0.2, 0, 0.9)
  wingL.rotation.y = 0.05
  group.add(wingL)
  // Right wing
  const wingR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 1.6))
  wingR.position.set(-0.2, 0, -0.9)
  wingR.rotation.y = -0.05
  group.add(wingR)
  // Vertical stabilizer
  const vStab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.04))
  vStab.position.set(-1.0, 0.35, 0)
  group.add(vStab)
  // Engine pods
  const engL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.7, 6))
  engL.rotation.z = Math.PI / 2
  engL.position.set(-0.8, -0.1, 0.7)
  group.add(engL)
  const engR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.7, 6))
  engR.rotation.z = Math.PI / 2
  engR.position.set(-0.8, -0.1, -0.7)
  group.add(engR)

  group.updateMatrixWorld(true)
  const geometries: THREE.BufferGeometry[] = []
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh
      const geo = mesh.geometry.clone()
      geo.applyMatrix4(mesh.matrixWorld)
      geometries.push(geo)
    }
  })
  return mergeGeos(geometries)
}

interface ShipState {
  pos: THREE.Vector3
  orbitCenter: THREE.Vector3
  orbitRadius: number
  orbitSpeed: number
  phase: number
  hue: number
  scale: number
}

interface WalkerState {
  pos: THREE.Vector3
  targetPos: THREE.Vector3
  phase: number
  speed: number
  scale: number
  walkCycle: number
  hue: number
}

function AlienWalker({ index, walkerRef }: { index: number; walkerRef: React.MutableRefObject<(THREE.Group | null)[]> }) {
  const legLRef = useRef<THREE.Group>(null)
  const legRRef = useRef<THREE.Group>(null)
  const legBLRef = useRef<THREE.Group>(null)

  return (
    <group ref={(el) => { walkerRef.current[index] = el }}>
      {/* Tall thin body */}
      <mesh position={[0, 1.0, 0]}>
        <capsuleGeometry args={[0.12, 0.8, 4, 6]} />
        <meshBasicMaterial color="#301848" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Head - elongated */}
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.18, 6, 5]} />
        <meshBasicMaterial color="#4020a0" transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Eyes (two small dots) */}
      <mesh position={[-0.07, 1.68, 0.14]}>
        <sphereGeometry args={[0.04, 4, 4]} />
        <meshBasicMaterial color="#80ffff" blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0.07, 1.68, 0.14]}>
        <sphereGeometry args={[0.04, 4, 4]} />
        <meshBasicMaterial color="#80ffff" blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Left leg (front) */}
      <group ref={legLRef} position={[-0.1, 0.3, 0.05]}>
        <mesh>
          <cylinderGeometry args={[0.04, 0.03, 0.6, 4]} />
          <meshBasicMaterial color="#201040" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      {/* Right leg (front) */}
      <group ref={legRRef} position={[0.1, 0.3, 0.05]}>
        <mesh>
          <cylinderGeometry args={[0.04, 0.03, 0.6, 4]} />
          <meshBasicMaterial color="#201040" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      {/* Back leg (third leg for alien feel) */}
      <group ref={legBLRef} position={[0, 0.3, -0.12]}>
        <mesh>
          <cylinderGeometry args={[0.035, 0.025, 0.55, 4]} />
          <meshBasicMaterial color="#201040" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

export function AlienDrones() {
  const { camera } = useThree()
  const shipRefs = useRef<(THREE.Group | null)[]>([])
  const walkerRefs = useRef<(THREE.Group | null)[]>([])

  const ships = useMemo<ShipState[]>(() => {
    const rand = seededRandom(555)
    return Array.from({ length: SHIP_COUNT }, () => ({
      pos: new THREE.Vector3(0, 3, 0),
      orbitCenter: new THREE.Vector3((rand() - 0.5) * 30, 3 + rand() * 4, (rand() - 0.5) * 30),
      orbitRadius: 6 + rand() * 12,
      orbitSpeed: 0.2 + rand() * 0.3,
      phase: rand() * Math.PI * 2,
      hue: rand() * 360,
      scale: 0.5 + rand() * 0.35,
    }))
  }, [])

  const walkers = useMemo<WalkerState[]>(() => {
    const rand = seededRandom(888)
    return Array.from({ length: WALKER_COUNT }, () => ({
      pos: new THREE.Vector3((rand() - 0.5) * 20, 0, (rand() - 0.5) * 20),
      targetPos: new THREE.Vector3((rand() - 0.5) * 20, 0, (rand() - 0.5) * 20),
      phase: rand() * Math.PI * 2,
      speed: 0.8 + rand() * 1.0,
      scale: 0.6 + rand() * 0.3,
      walkCycle: 0,
      hue: 200 + rand() * 160,
    }))
  }, [])

  const shipGeo = useMemo(() => createShipGeometry(), [])

  useFrame((_, delta) => {
    const camPos = new THREE.Vector3()
    camera.getWorldPosition(camPos)

    // Ships
    for (let i = 0; i < ships.length; i++) {
      const s = ships[i]
      s.phase += delta * s.orbitSpeed
      s.orbitCenter.x = THREE.MathUtils.lerp(s.orbitCenter.x, camPos.x + (i - SHIP_COUNT / 2) * 18, delta * 0.06)
      s.orbitCenter.z = THREE.MathUtils.lerp(s.orbitCenter.z, camPos.z + (i % 2 === 0 ? 15 : -15), delta * 0.06)
      s.orbitCenter.y = THREE.MathUtils.lerp(s.orbitCenter.y, camPos.y + 4 + Math.sin(s.phase * 0.3) * 2, delta * 0.1)
      s.pos.x = s.orbitCenter.x + Math.cos(s.phase) * s.orbitRadius
      s.pos.z = s.orbitCenter.z + Math.sin(s.phase) * s.orbitRadius * 0.7
      s.pos.y = s.orbitCenter.y + Math.sin(s.phase * 1.3) * 1.5

      const shipGroup = shipRefs.current[i]
      if (shipGroup) {
        shipGroup.position.copy(s.pos)
        shipGroup.rotation.y = s.phase + Math.PI / 2
        shipGroup.rotation.z = Math.sin(s.phase) * 0.12
        shipGroup.rotation.x = Math.cos(s.phase * 0.7) * 0.06
      }
    }

    // Walkers on platforms
    for (let i = 0; i < walkers.length; i++) {
      const w = walkers[i]
      w.phase += delta

      const distToPlayer = w.pos.distanceTo(camPos)
      if (distToPlayer > 35) {
        const angle = Math.random() * Math.PI * 2
        w.pos.set(camPos.x + Math.cos(angle) * 15, camPos.y, camPos.z + Math.sin(angle) * 15)
        w.targetPos.copy(w.pos)
      } else if (w.pos.distanceTo(w.targetPos) < 1.0) {
        const angle = Math.random() * Math.PI * 2
        const dist = 5 + Math.random() * 10
        w.targetPos.set(w.pos.x + Math.cos(angle) * dist, w.pos.y, w.pos.z + Math.sin(angle) * dist)
      }

      const dir = w.targetPos.clone().sub(w.pos)
      let isMoving = false
      if (dir.lengthSq() > 0.1) {
        dir.normalize()
        w.pos.addScaledVector(dir, w.speed * delta)
        isMoving = true
        w.walkCycle += delta * w.speed * 4
      }

      const group = walkerRefs.current[i]
      if (group) {
        group.position.copy(w.pos)
        group.scale.setScalar(w.scale)
        if (dir.lengthSq() > 0.01) group.rotation.y = Math.atan2(dir.x, dir.z)

        // Walking leg animation
        const legSwing = isMoving ? Math.sin(w.walkCycle) * 0.45 : 0
        const legs = group.children.filter((_, idx) => idx >= 4)
        if (legs[0]) legs[0].rotation.x = legSwing
        if (legs[1]) legs[1].rotation.x = -legSwing
        if (legs[2]) legs[2].rotation.x = legSwing * 0.7

        // Body sway
        const body = group.children[0]
        if (body) body.rotation.z = isMoving ? Math.sin(w.walkCycle * 0.5) * 0.05 : 0
      }
    }
  })

  return (
    <group>
      {/* Ships */}
      {ships.map((s, i) => (
        <group key={`ship-${i}`} ref={(el) => { shipRefs.current[i] = el }}>
          <mesh geometry={shipGeo} scale={s.scale}>
            <meshStandardMaterial color={`hsl(${s.hue}, 25%, 35%)`} emissive={`hsl(${s.hue}, 50%, 12%)`} metalness={0.85} roughness={0.25} />
          </mesh>
          {/* Engine exhaust */}
          <mesh position={[-s.scale * 1.8, 0, s.scale * 0.7]} scale={s.scale * 0.35}>
            <sphereGeometry args={[0.3, 5, 5]} />
            <meshBasicMaterial color={`hsl(${(s.hue + 180) % 360}, 90%, 65%)`} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh position={[-s.scale * 1.8, 0, -s.scale * 0.7]} scale={s.scale * 0.35}>
            <sphereGeometry args={[0.3, 5, 5]} />
            <meshBasicMaterial color={`hsl(${(s.hue + 180) % 360}, 90%, 65%)`} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          {/* Nav light */}
          <mesh position={[s.scale * 1.0, s.scale * 0.25, 0]} scale={s.scale * 0.2}>
            <sphereGeometry args={[0.2, 4, 4]} />
            <meshBasicMaterial color="#80ffff" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}

      {/* Alien walkers */}
      {walkers.map((_, i) => (
        <AlienWalker key={`walker-${i}`} index={i} walkerRef={walkerRefs} />
      ))}
    </group>
  )
}
