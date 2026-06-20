import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function PlayerLight() {
  const mainRef = useRef<THREE.PointLight>(null)
  const fillRef = useRef<THREE.PointLight>(null)

  useFrame(({ camera }) => {
    if (mainRef.current) {
      mainRef.current.position.copy(camera.position)
      mainRef.current.position.y += 1.2
    }
    if (fillRef.current) {
      fillRef.current.position.copy(camera.position)
      fillRef.current.position.y += 0.5
    }
  })

  return (
    <>
      <pointLight
        ref={mainRef}
        color="#fff5d4"
        intensity={1.5}
        distance={15}
        decay={2}
      />
      <pointLight
        ref={fillRef}
        color="#ffe8b0"
        intensity={0.6}
        distance={10}
        decay={2}
      />
    </>
  )
}
