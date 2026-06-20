import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { LevelType } from '../store/gameStore'
import { useGameStore } from '../store/gameStore'

interface PortalProps {
  position: [number, number, number]
  targetLevel: LevelType
  label: string
  color?: string
}

const PORTAL_HEIGHT = 2.8
const TRIGGER_DISTANCE = 2.0

export function Portal({ position, targetLevel, label, color = '#60d0ff' }: PortalProps) {
  const outerRingRef = useRef<THREE.Mesh>(null)
  const innerRingRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const particlesRef = useRef<THREE.Points>(null)
  const startTransition = useGameStore((s) => s.startTransition)
  const transitioning = useGameStore((s) => s.transitioning)
  const { camera } = useThree()
  const triggered = useRef(false)

  const particleGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const count = 80
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count * 3; i += 3) {
      const angle = Math.random() * Math.PI * 2
      const radius = 0.5 + Math.random() * 0.7
      positions[i] = Math.cos(angle) * radius
      positions[i + 1] = (Math.random() - 0.5) * 2.5
      positions[i + 2] = Math.sin(angle) * radius * 0.3
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])

  const labelTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, 512, 128)
    ctx.fillStyle = color
    ctx.font = 'bold 42px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = color
    ctx.shadowBlur = 15
    ctx.fillText(label, 256, 55)
    ctx.font = '24px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.shadowBlur = 0
    ctx.fillText('>>> 走近传送 >>>', 256, 100)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [label, color])

  useFrame((state) => {
    const time = state.clock.elapsedTime

    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = time * 0.5
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z = -time * 0.8
    }

    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.25 + Math.sin(time * 2.5) * 0.15
      const s = 1.0 + Math.sin(time * 1.5) * 0.08
      glowRef.current.scale.setScalar(s)
    }

    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += 0.015
        if (positions[i + 1] > 1.3) positions[i + 1] = -1.3
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true
      particlesRef.current.rotation.y = time * 0.3
    }

    const portalCenter = new THREE.Vector3(position[0], position[1] + PORTAL_HEIGHT / 2, position[2])
    const camWorldPos = new THREE.Vector3()
    camera.getWorldPosition(camWorldPos)
    const dist = camWorldPos.distanceTo(portalCenter)

    if (dist < TRIGGER_DISTANCE && !triggered.current && !transitioning) {
      triggered.current = true
      startTransition(targetLevel)
      setTimeout(() => { triggered.current = false }, 4000)
    }
  })

  return (
    <group position={position}>
      {/* Outer ring */}
      <mesh ref={outerRingRef} position={[0, PORTAL_HEIGHT / 2, 0]}>
        <torusGeometry args={[1.3, 0.08, 16, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Inner ring */}
      <mesh ref={innerRingRef} position={[0, PORTAL_HEIGHT / 2, 0]}>
        <torusGeometry args={[0.9, 0.04, 12, 48]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={2}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Portal glow plane */}
      <mesh ref={glowRef} position={[0, PORTAL_HEIGHT / 2, 0]}>
        <circleGeometry args={[1.15, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Particles */}
      <points ref={particlesRef} position={[0, PORTAL_HEIGHT / 2, 0]} geometry={particleGeo}>
        <pointsMaterial
          color={color}
          size={0.06}
          transparent
          opacity={0.7}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Glow sphere instead of PointLight to avoid uniform overflow */}
      <mesh position={[0, PORTAL_HEIGHT / 2, 0]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} toneMapped={false} />
      </mesh>

      {/* Floor glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[1.5, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Label */}
      <mesh position={[0, PORTAL_HEIGHT + 0.6, 0]}>
        <planeGeometry args={[3, 0.8]} />
        <meshBasicMaterial
          map={labelTexture}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
