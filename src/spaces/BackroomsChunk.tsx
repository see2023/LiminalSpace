import { useMemo } from 'react'
import * as THREE from 'three'
import type { ChunkData } from '../procedural/mazeGenerator'
import { CELL_SIZE, CHUNK_CELLS } from '../procedural/mazeGenerator'
import { FluorescentLight } from '../effects/FluorescentLight'

const WALL_HEIGHT = 3
const WALL_THICKNESS = 0.15

interface BackroomsChunkProps {
  chunk: ChunkData
  wallTexture: THREE.Texture
  floorTexture: THREE.Texture
  ceilingTexture: THREE.Texture
}

interface WallSeg {
  pos: [number, number, number]
  scale: [number, number, number]
}

export function BackroomsChunk({ chunk, wallTexture, floorTexture, ceilingTexture }: BackroomsChunkProps) {
  const chunkWorldSize = CHUNK_CELLS * CELL_SIZE
  const offsetX = chunk.cx * chunkWorldSize
  const offsetZ = chunk.cz * chunkWorldSize

  const { wallSegments, lights } = useMemo(() => {
    const segs: WallSeg[] = []
    const lts: { pos: [number, number, number]; flicker: boolean }[] = []
    const placed = new Set<string>()

    for (let z = 0; z < CHUNK_CELLS; z++) {
      for (let x = 0; x < CHUNK_CELLS; x++) {
        const cell = chunk.cells[z][x]
        const cx = offsetX + x * CELL_SIZE + CELL_SIZE / 2
        const cz = offsetZ + z * CELL_SIZE + CELL_SIZE / 2

        const addWall = (key: string, pos: [number, number, number], scale: [number, number, number]) => {
          if (placed.has(key)) return
          placed.add(key)
          segs.push({ pos, scale })
        }

        if (cell.wallNorth) {
          addWall(`h${offsetX + x * CELL_SIZE},${offsetZ + z * CELL_SIZE}`,
            [cx, WALL_HEIGHT / 2, cz - CELL_SIZE / 2],
            [CELL_SIZE + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS])
        }
        if (cell.wallSouth) {
          addWall(`h${offsetX + x * CELL_SIZE},${offsetZ + (z + 1) * CELL_SIZE}`,
            [cx, WALL_HEIGHT / 2, cz + CELL_SIZE / 2],
            [CELL_SIZE + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS])
        }
        if (cell.wallEast) {
          addWall(`v${offsetX + (x + 1) * CELL_SIZE},${offsetZ + z * CELL_SIZE}`,
            [cx + CELL_SIZE / 2, WALL_HEIGHT / 2, cz],
            [WALL_THICKNESS, WALL_HEIGHT, CELL_SIZE + WALL_THICKNESS])
        }
        if (cell.wallWest) {
          addWall(`v${offsetX + x * CELL_SIZE},${offsetZ + z * CELL_SIZE}`,
            [cx - CELL_SIZE / 2, WALL_HEIGHT / 2, cz],
            [WALL_THICKNESS, WALL_HEIGHT, CELL_SIZE + WALL_THICKNESS])
        }

        if ((x + z) % 3 === 0) {
          lts.push({
            pos: [cx, WALL_HEIGHT - 0.02, cz],
            flicker: ((x * 7 + z * 13 + chunk.cx * 31 + chunk.cz * 37) % 7) === 0,
          })
        }
      }
    }

    return { wallSegments: segs, lights: lts }
  }, [chunk, offsetX, offsetZ])

  const wallMaterial = useMemo(() => (
    new THREE.MeshStandardMaterial({
      map: wallTexture,
      roughness: 0.85,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  ), [wallTexture])

  const wallGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  return (
    <group>
      {/* Floor */}
      <mesh
        position={[offsetX + chunkWorldSize / 2, 0, offsetZ + chunkWorldSize / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[chunkWorldSize, chunkWorldSize]} />
        <meshStandardMaterial map={floorTexture} roughness={1} />
      </mesh>

      {/* Ceiling */}
      <mesh
        position={[offsetX + chunkWorldSize / 2, WALL_HEIGHT, offsetZ + chunkWorldSize / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[chunkWorldSize, chunkWorldSize]} />
        <meshStandardMaterial map={ceilingTexture} roughness={0.8} />
      </mesh>

      {/* Walls */}
      {wallSegments.map((seg, i) => (
        <mesh
          key={i}
          position={seg.pos}
          scale={seg.scale}
          geometry={wallGeometry}
          material={wallMaterial}
          castShadow
          receiveShadow
        />
      ))}

      {/* Lights */}
      {lights.map((lt, i) => (
        <FluorescentLight
          key={`light-${i}`}
          position={lt.pos}
          flicker={lt.flicker}
        />
      ))}
    </group>
  )
}
