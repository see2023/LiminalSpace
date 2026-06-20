import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface FluorescentLightProps {
  position: [number, number, number]
  size?: [number, number]
  flicker?: boolean
}

export function FluorescentLight({ position, size = [1.5, 0.3], flicker = false }: FluorescentLightProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const flickerPhase = useRef(Math.random() * 100)
  const nextFlickerTime = useRef(0)
  const isFlickering = useRef(false)

  useFrame((state) => {
    if (!meshRef.current) return
    const mat = meshRef.current.material as THREE.MeshStandardMaterial

    if (!flicker) {
      mat.emissiveIntensity = 1.0
      return
    }

    const time = state.clock.elapsedTime + flickerPhase.current

    if (time > nextFlickerTime.current) {
      if (isFlickering.current) {
        isFlickering.current = false
        nextFlickerTime.current = time + 4 + Math.random() * 20
      } else if (Math.random() < 0.02) {
        isFlickering.current = true
        nextFlickerTime.current = time + 0.05 + Math.random() * 0.15
      }
    }

    mat.emissiveIntensity = isFlickering.current
      ? (Math.random() > 0.5 ? 0.2 : 1.0)
      : 0.85 + Math.sin(time * 0.5) * 0.15
  })

  return (
    <mesh ref={meshRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={size} />
      <meshStandardMaterial
        color="#fffde8"
        emissive="#fffde8"
        emissiveIntensity={1}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  )
}
