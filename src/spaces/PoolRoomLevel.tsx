import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createPoolTileTexture, createCeilingTexture } from '../procedural/textureFactory'
import { Atmosphere } from '../effects/Atmosphere'
import { FluorescentLight } from '../effects/FluorescentLight'
import { Portal } from './Portal'

import { POOL_MAP, POOL_CELL_SIZE } from '../utils/collision'
import { PoolCreatures } from '../npcs/PoolCreatures'

const WATER_SURFACE = 0.3
const CEILING_HEIGHT = 6

function WaterSurface() {
  const waterRef = useRef<THREE.Mesh>(null)
  
  const waterMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#2080a8') }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        uniform float uTime;
        void main() {
          vec3 pos = position;
          // Gentle low-frequency wave on vertices
          pos.z += sin(pos.x * 0.2 + uTime) * 0.1;
          vec4 worldPos = modelMatrix * vec4(pos, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec3 vWorldPos;

        float wave(vec2 uv, float t) {
          vec2 p1 = uv * 1.5;
          vec2 p2 = uv * 3.0;
          return sin(p1.x + t) * cos(p1.y + t * 0.8) * 0.1 +
                 sin(p2.x - t * 1.2) * cos(p2.y + t) * 0.05;
        }

        void main() {
          float t = uTime * 0.8;
          vec2 uv = vWorldPos.xz;
          
          float w = wave(uv, t);
          float wx = wave(uv + vec2(0.05, 0.0), t);
          float wz = wave(uv + vec2(0.0, 0.05), t);
          
          // Calculate normal from analytical derivatives
          vec3 normal = normalize(vec3(w - wx, 0.05, w - wz));
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          
          // Fresnel reflection
          float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);
          vec3 reflectColor = vec3(0.7, 0.9, 1.0);
          vec3 finalColor = mix(uColor, reflectColor, fresnel * 0.6);
          
          // Fake specular from overhead lights
          vec3 lightDir = normalize(vec3(0.5, 1.0, 0.2));
          vec3 halfVector = normalize(lightDir + viewDir);
          float specular = pow(max(dot(normal, halfVector), 0.0), 128.0);
          
          gl_FragColor = vec4(finalColor + specular * 0.4, 0.6 + fresnel * 0.3);
        }
      `
    })
  }, [])

  useFrame((state) => {
    waterMat.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_SURFACE, 0]}>
      <planeGeometry args={[120, 120, 64, 64]} />
      <primitive object={waterMat} attach="material" />
    </mesh>
  )
}

function Caustics() {
  const causticsRef = useRef<THREE.Mesh>(null)
  const causticsMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vWorldPos;

        float caustic(vec2 uv, float t) {
          vec2 p = uv * 4.0;
          float a = sin(p.x + t) * sin(p.y + t * 0.7);
          float b = sin(p.x * 1.3 - t * 0.8) * sin(p.y * 1.1 + t * 0.6);
          return pow(abs(a + b) * 0.5, 2.0);
        }

        void main() {
          // Project caustics downwards onto any surface
          float c = caustic(vWorldPos.xz * 0.2, uTime * 0.8) + caustic(vWorldPos.xz * 0.3 + 0.3, uTime * 1.2) * 0.5;
          // Fade out based on Y height (stronger deeper)
          float depthFade = smoothstep(1.0, -4.0, vWorldPos.y);
          vec3 col = vec3(0.4, 0.8, 1.0) * c * depthFade * 0.6;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  }, [])

  useFrame((state) => {
    causticsMat.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <mesh ref={causticsRef} position={[0, -1, 0]}>
      <boxGeometry args={[100, 4, 100]} />
      <primitive object={causticsMat} attach="material" side={THREE.BackSide} />
    </mesh>
  )
}

function PoolArchitecture({ tileTex }: { tileTex: THREE.Texture }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.3, metalness: 0.1 }), [tileTex])
  
  const cells = useMemo(() => {
    const arr = []
    const halfSize = (POOL_MAP.length * POOL_CELL_SIZE) / 2

    for (let row = 0; row < POOL_MAP.length; row++) {
      for (let col = 0; col < POOL_MAP[row].length; col++) {
        const type = POOL_MAP[row][col]
        const x = col * POOL_CELL_SIZE - halfSize + POOL_CELL_SIZE / 2
        const z = row * POOL_CELL_SIZE - halfSize + POOL_CELL_SIZE / 2

        if (type === 'W') {
          // Wall from bottom to ceiling
          arr.push(
            <mesh key={`${row}-${col}`} position={[x, 1.0, z]} receiveShadow>
              <boxGeometry args={[POOL_CELL_SIZE, 10, POOL_CELL_SIZE]} />
              <primitive object={mat} attach="material" />
            </mesh>
          )
        } else {
          // Floor blocks (extend downwards to prevent gaps when stepping down)
          const h = type === 'F' ? 0.2 : type === 'S' ? -0.8 : -2.5
          const depth = h - (-4.0) // Extend down to Y=-4
          arr.push(
            <mesh key={`${row}-${col}`} position={[x, h - depth / 2, z]} receiveShadow>
              <boxGeometry args={[POOL_CELL_SIZE, depth, POOL_CELL_SIZE]} />
              <primitive object={mat} attach="material" />
            </mesh>
          )
        }
      }
    }
    return arr
  }, [mat])

  return <group>{cells}</group>
}

export function PoolRoomLevel() {
  const { camera } = useThree()
  const underwaterFogRef = useRef<THREE.Mesh>(null)

  const textures = useMemo(() => {
    const tile = createPoolTileTexture()
    const ceiling = createCeilingTexture()
    // Adjust repeats for better scale on large geometry
    tile.repeat.set(0.5, 0.5) 
    return { tile, ceiling }
  }, [])

  useFrame(() => {
    if (underwaterFogRef.current) {
      const isUnderwater = camera.position.y < WATER_SURFACE
      const mat = underwaterFogRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = isUnderwater ? 0.25 : 0
      underwaterFogRef.current.position.copy(camera.position)
    }
  })

  return (
    <>
      <Atmosphere
        fogColor="#2a6080"
        fogNear={1}
        fogFar={45}
        ambientColor="#80c0d8"
        ambientIntensity={0.6}
      />

      <PoolArchitecture tileTex={textures.tile} />
      <WaterSurface />
      <Caustics />

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CEILING_HEIGHT, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial map={textures.ceiling} roughness={0.9} />
      </mesh>

      {/* Underwater tint overlay (follows camera) */}
      <mesh ref={underwaterFogRef}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="#1a5070" transparent opacity={0} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {/* Lights above water */}
      {[-30, -10, 10, 30].map((x) => 
        [-30, -10, 10, 30].map((z) => (
          <FluorescentLight key={`light-${x}-${z}`} position={[x, CEILING_HEIGHT - 0.5, z]} flicker={(x + z) % 40 === 0} />
        ))
      )}

      {/* Portals placed on dry walkways */}
      <Portal position={[-17.5, 1.4, -32.5]} targetLevel="backrooms" label="Backrooms" color="#c8a040" />
      <Portal position={[32.5, 1.4, 32.5]} targetLevel="voidstation" label="Void Station" color="#8060f0" />

      <PoolCreatures />
    </>
  )
}
