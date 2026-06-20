import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'

const TUNNEL_DURATION = 2.5
const STAR_COUNT = 2500
const TUNNEL_RADIUS = 2.5
const TUNNEL_LENGTH = 40

export function WormholeTransition() {
  const transitioning = useGameStore((s) => s.transitioning)
  const endTransition = useGameStore((s) => s.endTransition)
  const progressRef = useRef(0)
  const starsRef = useRef<THREE.Points>(null)
  const flashRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const bgRef = useRef<THREE.Mesh>(null)

  const starGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(STAR_COUNT * 3)
    const colors = new Float32Array(STAR_COUNT * 3)

    for (let i = 0; i < STAR_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2
      const r = TUNNEL_RADIUS * (0.4 + Math.random() * 0.6)
      const z = (Math.random() - 0.5) * TUNNEL_LENGTH

      positions[i * 3] = Math.cos(angle) * r
      positions[i * 3 + 1] = Math.sin(angle) * r
      positions[i * 3 + 2] = z

      const hue = Math.random()
      const color = new THREE.Color().setHSL(hue * 0.3 + 0.55, 0.8, 0.6 + Math.random() * 0.4)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])

  const tunnelMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: true,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uProgress;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec2 uv = vUv;
          float angle = uv.x * 6.28318 + uTime * 2.5;
          float depth = uv.y;

          // Base dark space color
          vec3 col = vec3(0.02, 0.01, 0.06);

          // Swirling energy lines
          float line1 = smoothstep(0.97, 1.0, fract(angle * 6.0 + depth * 15.0 - uTime * 2.0));
          float line2 = smoothstep(0.97, 1.0, fract(depth * 30.0 - uTime * 4.0));
          col += vec3(0.15, 0.05, 0.4) * line1;
          col += vec3(0.05, 0.2, 0.5) * line2;

          // Scattered stars on the tunnel wall
          vec2 starUV = vec2(angle * 4.0, depth * 40.0 - uTime * 6.0);
          float star = step(0.995, hash(floor(starUV)));
          col += vec3(0.9, 0.95, 1.0) * star * 3.0;

          // Nebula glow
          float nebula = pow(sin(angle * 2.0 + uTime) * 0.5 + 0.5, 4.0) * 0.15;
          col += vec3(0.3, 0.1, 0.6) * nebula;

          // Brighter toward the exit
          col += vec3(0.2, 0.4, 0.8) * pow(depth, 4.0) * uProgress;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  }, [])

  useFrame(({ camera }, delta) => {
    if (!transitioning) {
      progressRef.current = 0
      return
    }

    progressRef.current += delta / TUNNEL_DURATION

    if (progressRef.current >= 1.0) {
      progressRef.current = 0
      endTransition()
      return
    }

    const p = progressRef.current
    tunnelMat.uniforms.uTime.value += delta
    tunnelMat.uniforms.uProgress.value = p

    if (groupRef.current) {
      groupRef.current.position.copy(camera.position)
      groupRef.current.quaternion.copy(camera.quaternion)
    }

    if (bgRef.current) {
      const mat = bgRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = Math.min(1, p * 5)
    }

    if (starsRef.current) {
      const positions = starsRef.current.geometry.attributes.position.array as Float32Array
      const speed = 15 + p * 25
      for (let i = 0; i < STAR_COUNT; i++) {
        positions[i * 3 + 2] += delta * speed
        if (positions[i * 3 + 2] > TUNNEL_LENGTH / 2) {
          positions[i * 3 + 2] -= TUNNEL_LENGTH
        }
      }
      starsRef.current.geometry.attributes.position.needsUpdate = true
      starsRef.current.rotation.z += delta * (1.0 + p * 2.0)
    }

    if (flashRef.current) {
      const flashMat = flashRef.current.material as THREE.MeshBasicMaterial
      const flashProgress = Math.max(0, (p - 0.7) / 0.3)
      flashMat.opacity = flashProgress * flashProgress
      flashRef.current.scale.setScalar(1 + flashProgress * 8)
    }
  })

  if (!transitioning) return null

  return (
    <group ref={groupRef} renderOrder={999}>
      {/* Black background sphere to hide the level behind */}
      <mesh ref={bgRef} renderOrder={998}>
        <sphereGeometry args={[TUNNEL_RADIUS + 1, 16, 16]} />
        <meshBasicMaterial color="#000005" side={THREE.BackSide} transparent opacity={0} />
      </mesh>

      {/* Tunnel cylinder - fully opaque */}
      <mesh rotation={[Math.PI / 2, 0, 0]} material={tunnelMat} renderOrder={999}>
        <cylinderGeometry args={[TUNNEL_RADIUS, TUNNEL_RADIUS * 0.8, TUNNEL_LENGTH, 32, 1, true]} />
      </mesh>

      {/* Stars flying past */}
      <points ref={starsRef} geometry={starGeo} renderOrder={1000}>
        <pointsMaterial
          vertexColors
          size={0.1}
          transparent
          opacity={0.95}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* End flash / exit light */}
      <mesh ref={flashRef} position={[0, 0, -TUNNEL_LENGTH / 3]} renderOrder={1001}>
        <circleGeometry args={[2.5, 32]} />
        <meshBasicMaterial
          color="#c0d8ff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Front cap to block view behind */}
      <mesh position={[0, 0, TUNNEL_LENGTH / 2.5]} renderOrder={998}>
        <circleGeometry args={[TUNNEL_RADIUS + 0.5, 32]} />
        <meshBasicMaterial color="#000005" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
