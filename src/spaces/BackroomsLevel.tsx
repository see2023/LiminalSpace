import { useMemo, useState, useEffect, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import { getChunk, worldToChunk, CHUNK_CELLS, CELL_SIZE } from '../procedural/mazeGenerator'
import {
  createWallpaperTexture,
  createCarpetTexture,
  createCeilingTexture,
} from '../procedural/textureFactory'
import { BackroomsChunk } from './BackroomsChunk'
import { Atmosphere } from '../effects/Atmosphere'
import { Portal } from './Portal'

const RENDER_DISTANCE = 2

function getChunkKeys(camX: number, camZ: number): string[] {
  const [cx, cz] = worldToChunk(camX, camZ)
  const keys: string[] = []
  for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      keys.push(`${cx + dx},${cz + dz}`)
    }
  }
  return keys
}

export function BackroomsLevel() {
  const { camera } = useThree()
  const [activeChunks, setActiveChunks] = useState<string[]>(() =>
    getChunkKeys(6, 6)
  )

  const textures = useMemo(() => ({
    wall: createWallpaperTexture(),
    floor: createCarpetTexture(),
    ceiling: createCeilingTexture(),
  }), [])

  const updateChunks = useCallback(() => {
    const keys = getChunkKeys(camera.position.x, camera.position.z)
    setActiveChunks((prev) => {
      const newSet = keys.join('|')
      const oldSet = prev.join('|')
      return newSet === oldSet ? prev : keys
    })
  }, [camera])

  useEffect(() => {
    updateChunks()
    const interval = setInterval(updateChunks, 300)
    return () => clearInterval(interval)
  }, [updateChunks])

  const chunks = useMemo(() => {
    return activeChunks.map((key) => {
      const [cx, cz] = key.split(',').map(Number)
      return getChunk(cx, cz)
    })
  }, [activeChunks])

  const chunkWorldSize = CHUNK_CELLS * CELL_SIZE
  const portalPos1: [number, number, number] = [chunkWorldSize / 2, 0, chunkWorldSize / 2 + 8]
  const portalPos2: [number, number, number] = [chunkWorldSize / 2 + 8, 0, chunkWorldSize / 2]

  return (
    <>
      <Atmosphere
        fogColor="#b89840"
        fogNear={0.5}
        fogFar={25}
        ambientColor="#fff5d4"
        ambientIntensity={0.25}
      />

      {chunks.map((chunk) => (
        <BackroomsChunk
          key={`${chunk.cx},${chunk.cz}`}
          chunk={chunk}
          wallTexture={textures.wall}
          floorTexture={textures.floor}
          ceilingTexture={textures.ceiling}
        />
      ))}

      <Portal position={portalPos1} targetLevel="poolrooms" label="Pool Rooms" color="#40c8ff" />
      <Portal position={portalPos2} targetLevel="voidstation" label="Void Station" color="#8060f0" />
    </>
  )
}
