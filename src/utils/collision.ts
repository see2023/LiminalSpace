import { worldToChunk, getChunk, CELL_SIZE, CHUNK_CELLS } from '../procedural/mazeGenerator'

export const PLAYER_RADIUS = 0.35

export function isWallAt(worldX: number, worldZ: number): boolean {
  const chunkWorldSize = CHUNK_CELLS * CELL_SIZE
  const [cx, cz] = worldToChunk(worldX, worldZ)
  const chunk = getChunk(cx, cz)

  const localX = worldX - cx * chunkWorldSize
  const localZ = worldZ - cz * chunkWorldSize
  const cellX = Math.floor(localX / CELL_SIZE)
  const cellZ = Math.floor(localZ / CELL_SIZE)

  if (cellX < 0 || cellX >= CHUNK_CELLS || cellZ < 0 || cellZ >= CHUNK_CELLS) return false

  const cell = chunk.cells[cellZ][cellX]
  const inCellX = localX - cellX * CELL_SIZE
  const inCellZ = localZ - cellZ * CELL_SIZE

  const wallThickness = 0.3

  if (inCellZ < wallThickness && cell.wallNorth) return true
  if (inCellZ > CELL_SIZE - wallThickness && cell.wallSouth) return true
  if (inCellX > CELL_SIZE - wallThickness && cell.wallEast) return true
  if (inCellX < wallThickness && cell.wallWest) return true

  return false
}

export const VS_CELL = 14
export const VS_PLATFORM = 5
export const VS_CORRIDOR_W = 2.4

function vsRand(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 4294967296
  }
}

function vsSeed(x: number, y: number, z: number): number {
  return ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) & 0x7fffffff
}

export interface VoidCellData {
  exists: boolean
  connectX: boolean
  connectZ: boolean
  connectY: boolean // Elevator UP
  hue: number
}

export function getVoidCellData(gx: number, gy: number, gz: number): VoidCellData {
  const r = vsRand(vsSeed(gx, gy, gz))
  const exists = r() > 0.12
  const connectX = r() > 0.18
  const connectZ = r() > 0.18
  const connectY = r() > 0.85 // 15% chance to have an elevator up
  const hue = (r() * 360) | 0
  return { exists, connectX, connectZ, connectY, hue }
}

export function isVoidWalkable(worldX: number, worldY: number, worldZ: number): boolean {
  const gy = Math.round(worldY / VS_CELL)
  const gx = Math.round(worldX / VS_CELL)
  const gz = Math.round(worldZ / VS_CELL)

  const localX = worldX - gx * VS_CELL
  const localZ = worldZ - gz * VS_CELL

  const halfPlat = VS_PLATFORM / 2
  const halfCorr = VS_CORRIDOR_W / 2

  // On platform
  if (Math.abs(localX) <= halfPlat && Math.abs(localZ) <= halfPlat) {
    return getVoidCellData(gx, gy, gz).exists
  }

  // Corridor +X
  if (localX > halfPlat && localX < VS_CELL / 2 && Math.abs(localZ) <= halfCorr) {
    return getVoidCellData(gx, gy, gz).connectX && getVoidCellData(gx, gy, gz).exists && getVoidCellData(gx + 1, gy, gz).exists
  }

  // Corridor -X
  if (localX < -halfPlat && localX > -VS_CELL / 2 && Math.abs(localZ) <= halfCorr) {
    return getVoidCellData(gx - 1, gy, gz).connectX && getVoidCellData(gx - 1, gy, gz).exists && getVoidCellData(gx, gy, gz).exists
  }

  // Corridor +Z
  if (localZ > halfPlat && localZ < VS_CELL / 2 && Math.abs(localX) <= halfCorr) {
    return getVoidCellData(gx, gy, gz).connectZ && getVoidCellData(gx, gy, gz).exists && getVoidCellData(gx, gy, gz + 1).exists
  }

  // Corridor -Z
  if (localZ < -halfPlat && localZ > -VS_CELL / 2 && Math.abs(localX) <= halfCorr) {
    return getVoidCellData(gx, gy, gz - 1).connectZ && getVoidCellData(gx, gy, gz - 1).exists && getVoidCellData(gx, gy, gz).exists
  }

  return false
}

export const POOL_CELL_SIZE = 5
export const POOL_MAP = [
  "WWWWWWWWWWWWWWWW",
  "WFFFFWSSSSSSDDDW",
  "WFFFFWSSWWWWDDDW",
  "WWWWSSSSWDDWDDDW",
  "WDDWSSWWWWWWSSSW",
  "WDDWSSWFFFFWSSSW",
  "WSSWSSWFFFFWSSSW",
  "WSSWWWWWWWWWWSSW",
  "WSSSSSSSSSSSSSSW",
  "WWWWWWWWWWWWSSSW",
  "WDDDDDDDDDDWSSSW",
  "WDDDDDDDDDDWSSSW",
  "WDDDDDDDDDDWSSSW",
  "WSSSSSSSSSSWFFFW",
  "WSSSSSSSSSSWFFFW",
  "WWWWWWWWWWWWWWWW",
]

export function getPoolGridCoords(x: number, z: number): [number, number] {
  const halfSize = (POOL_MAP.length * POOL_CELL_SIZE) / 2
  const col = Math.floor((x + halfSize) / POOL_CELL_SIZE)
  const row = Math.floor((z + halfSize) / POOL_CELL_SIZE)
  return [col, row]
}

export function getPoolCell(x: number, z: number): string {
  const [col, row] = getPoolGridCoords(x, z)
  if (row < 0 || row >= POOL_MAP.length || col < 0 || col >= POOL_MAP[0].length) return 'W'
  return POOL_MAP[row][col]
}

export function getPoolFloorHeight(x: number, z: number): number {
  const cell = getPoolCell(x, z)
  if (cell === 'W') return 10
  if (cell === 'F') return 0.2
  if (cell === 'S') return -0.8
  if (cell === 'D') return -2.5
  return -3.0
}

export function isPoolWall(x: number, z: number): boolean {
  return getPoolCell(x, z) === 'W'
}
