import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const SHADOW_COUNT = 8
const CRAWLER_COUNT = 6
const WANDER_RADIUS = 25
const PEEK_DISTANCE = 15
const FLEE_DISTANCE = 6

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 4294967296
  }
}

interface ShadowState {
  pos: THREE.Vector3
  targetPos: THREE.Vector3
  phase: number
  speed: number
  scale: number
  walkCycle: number
}

interface CrawlerState {
  pos: THREE.Vector3
  targetPos: THREE.Vector3
  phase: number
  speed: number
  scale: number
  walkCycle: number
}

function HumanoidMesh({ index, refs }: { index: number; refs: React.MutableRefObject<(THREE.Group | null)[]> }) {
  return (
    <group ref={(el) => { refs.current[index] = el }}>
      {/* Head */}
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.18, 6, 5]} />
        <meshBasicMaterial color="#050005" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      {/* Torso */}
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[0.4, 0.7, 0.2]} />
        <meshBasicMaterial color="#050005" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {/* Hips */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.35, 0.3, 0.18]} />
        <meshBasicMaterial color="#050005" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      {/* Left arm */}
      <group position={[-0.28, 1.0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.06, 0.05, 0.65, 4]} />
          <meshBasicMaterial color="#040004" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      </group>
      {/* Right arm */}
      <group position={[0.28, 1.0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.06, 0.05, 0.65, 4]} />
          <meshBasicMaterial color="#040004" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      </group>
      {/* Left leg - index 5 */}
      <group position={[-0.1, 0.35, 0]}>
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.07, 0.06, 0.7, 4]} />
          <meshBasicMaterial color="#040004" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      </group>
      {/* Right leg - index 6 */}
      <group position={[0.1, 0.35, 0]}>
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.07, 0.06, 0.7, 4]} />
          <meshBasicMaterial color="#040004" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

function CrawlerMesh({ index, crawlerRef }: { index: number; crawlerRef: React.MutableRefObject<(THREE.Group | null)[]> }) {
  return (
    <group ref={(el) => { crawlerRef.current[index] = el }}>
      {/* Body */}
      <mesh position={[0, 0.35, 0]}>
        <capsuleGeometry args={[0.2, 0.5, 4, 6]} />
        <meshBasicMaterial color="#0a0008" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.4, 0.35]}>
        <sphereGeometry args={[0.15, 5, 4]} />
        <meshBasicMaterial color="#080006" transparent opacity={0.75} depthWrite={false} />
      </mesh>
      {/* Front-left leg - index 2 */}
      <group position={[-0.2, 0.15, 0.15]}>
        <mesh>
          <cylinderGeometry args={[0.04, 0.03, 0.35, 4]} />
          <meshBasicMaterial color="#060004" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      </group>
      {/* Front-right leg - index 3 */}
      <group position={[0.2, 0.15, 0.15]}>
        <mesh>
          <cylinderGeometry args={[0.04, 0.03, 0.35, 4]} />
          <meshBasicMaterial color="#060004" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      </group>
      {/* Back-left leg - index 4 */}
      <group position={[-0.2, 0.15, -0.2]}>
        <mesh>
          <cylinderGeometry args={[0.04, 0.03, 0.35, 4]} />
          <meshBasicMaterial color="#060004" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      </group>
      {/* Back-right leg - index 5 */}
      <group position={[0.2, 0.15, -0.2]}>
        <mesh>
          <cylinderGeometry args={[0.04, 0.03, 0.35, 4]} />
          <meshBasicMaterial color="#060004" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

export function ShadowCreatures() {
  const { camera } = useThree()
  const shadowRefs = useRef<(THREE.Group | null)[]>([])
  const crawlerRefs = useRef<(THREE.Group | null)[]>([])

  const shadows = useMemo<ShadowState[]>(() => {
    const rand = seededRandom(777)
    return Array.from({ length: SHADOW_COUNT }, () => ({
      pos: new THREE.Vector3((rand() - 0.5) * WANDER_RADIUS * 2, 0, (rand() - 0.5) * WANDER_RADIUS * 2),
      targetPos: new THREE.Vector3((rand() - 0.5) * WANDER_RADIUS * 2, 0, (rand() - 0.5) * WANDER_RADIUS * 2),
      phase: rand() * Math.PI * 2,
      speed: 1.2 + rand() * 0.8,
      scale: 0.8 + rand() * 0.4,
      walkCycle: 0,
    }))
  }, [])

  const crawlers = useMemo<CrawlerState[]>(() => {
    const rand = seededRandom(333)
    return Array.from({ length: CRAWLER_COUNT }, () => ({
      pos: new THREE.Vector3((rand() - 0.5) * WANDER_RADIUS * 2, 0, (rand() - 0.5) * WANDER_RADIUS * 2),
      targetPos: new THREE.Vector3((rand() - 0.5) * 20, 0, (rand() - 0.5) * 20),
      phase: rand() * Math.PI * 2,
      speed: 2.0 + rand() * 1.5,
      scale: 0.7 + rand() * 0.5,
      walkCycle: 0,
    }))
  }, [])

  useFrame((_, delta) => {
    const camPos = camera.position

    // Humanoid shadows with walking animation
    for (let i = 0; i < shadows.length; i++) {
      const c = shadows[i]
      c.phase += delta
      const distToPlayer = c.pos.distanceTo(camPos)

      if (distToPlayer < FLEE_DISTANCE) {
        const dir = c.pos.clone().sub(camPos).normalize()
        c.targetPos.copy(c.pos).addScaledVector(dir, 12)
        c.targetPos.y = 0
      } else if (distToPlayer > WANDER_RADIUS * 1.5) {
        const angle = Math.random() * Math.PI * 2
        const dist = PEEK_DISTANCE + Math.random() * 8
        c.pos.set(camPos.x + Math.cos(angle) * dist, 0, camPos.z + Math.sin(angle) * dist)
        c.targetPos.copy(c.pos)
      } else if (c.pos.distanceTo(c.targetPos) < 1.5) {
        const angle = Math.random() * Math.PI * 2
        const dist = PEEK_DISTANCE * (0.6 + Math.random() * 0.8)
        c.targetPos.set(camPos.x + Math.cos(angle) * dist, 0, camPos.z + Math.sin(angle) * dist)
      }

      const moveSpeed = distToPlayer < FLEE_DISTANCE ? 4.0 : c.speed
      const dir = c.targetPos.clone().sub(c.pos)
      let isMoving = false
      if (dir.lengthSq() > 0.1) {
        dir.normalize()
        c.pos.addScaledVector(dir, moveSpeed * delta)
        isMoving = true
        c.walkCycle += delta * moveSpeed * 2.5
      }

      const group = shadowRefs.current[i]
      if (group) {
        group.position.set(c.pos.x, 0, c.pos.z)
        group.scale.setScalar(c.scale)
        if (dir.lengthSq() > 0.01) group.rotation.y = Math.atan2(dir.x, dir.z)

        // Walking: swing legs (children 5=left leg, 6=right leg)
        const legL = group.children[5]
        const legR = group.children[6]
        const armL = group.children[3]
        const armR = group.children[4]
        if (isMoving) {
          const swing = Math.sin(c.walkCycle) * 0.5
          if (legL) legL.rotation.x = swing
          if (legR) legR.rotation.x = -swing
          if (armL) armL.rotation.x = -swing * 0.4
          if (armR) armR.rotation.x = swing * 0.4
        } else {
          if (legL) legL.rotation.x = 0
          if (legR) legR.rotation.x = 0
          if (armL) armL.rotation.x = 0
          if (armR) armR.rotation.x = 0
        }

        // Opacity based on distance
        const opacity = distToPlayer < FLEE_DISTANCE ? 0.3 :
          distToPlayer < PEEK_DISTANCE ? 0.6 + Math.sin(c.phase * 1.5) * 0.15 :
          Math.max(0.2, 0.5 - (distToPlayer - PEEK_DISTANCE) / 20)
        group.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
            if (mat.opacity !== undefined) mat.opacity = opacity
          }
        })
      }
    }

    // Crawlers with 4-leg walk animation
    for (let i = 0; i < crawlers.length; i++) {
      const c = crawlers[i]
      c.phase += delta
      const distToPlayer = c.pos.distanceTo(camPos)

      if (distToPlayer < FLEE_DISTANCE + 2) {
        const dir = c.pos.clone().sub(camPos).normalize()
        c.targetPos.copy(c.pos).addScaledVector(dir, 10)
        c.targetPos.y = 0
      } else if (distToPlayer > WANDER_RADIUS * 1.8) {
        const angle = Math.random() * Math.PI * 2
        c.pos.set(camPos.x + Math.cos(angle) * 14, 0, camPos.z + Math.sin(angle) * 14)
        c.targetPos.copy(c.pos)
      } else if (c.pos.distanceTo(c.targetPos) < 1.0) {
        const angle = Math.random() * Math.PI * 2
        const dist = 8 + Math.random() * 12
        c.targetPos.set(camPos.x + Math.cos(angle) * dist, 0, camPos.z + Math.sin(angle) * dist)
      }

      const dir = c.targetPos.clone().sub(c.pos)
      let isMoving = false
      if (dir.lengthSq() > 0.1) {
        dir.normalize()
        const spd = distToPlayer < FLEE_DISTANCE + 2 ? c.speed * 1.8 : c.speed
        c.pos.addScaledVector(dir, spd * delta)
        isMoving = true
        c.walkCycle += delta * c.speed * 3
      }

      const group = crawlerRefs.current[i]
      if (group) {
        group.position.set(c.pos.x, 0, c.pos.z)
        group.scale.setScalar(c.scale)
        if (dir.lengthSq() > 0.01) group.rotation.y = Math.atan2(dir.x, dir.z)

        // Legs: children 2,3,4,5
        const legSwing = isMoving ? Math.sin(c.walkCycle) * 0.5 : 0
        if (group.children[2]) group.children[2].rotation.x = legSwing
        if (group.children[3]) group.children[3].rotation.x = -legSwing
        if (group.children[4]) group.children[4].rotation.x = -legSwing
        if (group.children[5]) group.children[5].rotation.x = legSwing

        // Body bob
        if (group.children[0]) {
          group.children[0].position.y = 0.35 + (isMoving ? Math.abs(Math.sin(c.walkCycle * 2)) * 0.05 : 0)
        }
      }
    }
  })

  return (
    <group>
      {shadows.map((_, i) => (
        <HumanoidMesh key={`s-${i}`} index={i} refs={shadowRefs} />
      ))}
      {crawlers.map((_, i) => (
        <CrawlerMesh key={`c-${i}`} index={i} crawlerRef={crawlerRefs} />
      ))}
    </group>
  )
}
