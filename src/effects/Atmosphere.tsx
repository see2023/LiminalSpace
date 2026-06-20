import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'

interface AtmosphereProps {
  fogColor?: string
  fogNear?: number
  fogFar?: number
  ambientColor?: string
  ambientIntensity?: number
}

export function Atmosphere({
  fogColor = '#c9a84c',
  fogNear = 1,
  fogFar = 30,
  ambientColor = '#fff5d4',
  ambientIntensity = 0.3,
}: AtmosphereProps) {
  const { scene } = useThree()

  useEffect(() => {
    scene.fog = new THREE.Fog(fogColor, fogNear, fogFar)
    scene.background = new THREE.Color(fogColor)
    return () => {
      scene.fog = null
      scene.background = null
    }
  }, [scene, fogColor, fogNear, fogFar])

  return <ambientLight color={ambientColor} intensity={ambientIntensity} />
}
