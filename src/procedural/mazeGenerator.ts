export interface MazeCell {
  x: number
  z: number
  wallNorth: boolean
  wallSouth: boolean
  wallEast: boolean
  wallWest: boolean
}

export interface ChunkData {
  cx: number
  cz: number
  cells: MazeCell[][]
}

const CHUNK_CELLS = 8
const CELL_SIZE = 4

type WallKey = 'wallNorth' | 'wallSouth' | 'wallEast' | 'wallWest'

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function chunkSeed(cx: number, cz: number): number {
  return ((cx * 73856093) ^ (cz * 19349663)) & 0x7fffffff
}

function setWall(cell: MazeCell, wall: WallKey, value: boolean) {
  cell[wall] = value
}

function generateMazeChunk(cx: number, cz: number): MazeCell[][] {
  const rand = seededRandom(chunkSeed(cx, cz))
  const cells: MazeCell[][] = []

  for (let z = 0; z < CHUNK_CELLS; z++) {
    cells[z] = []
    for (let x = 0; x < CHUNK_CELLS; x++) {
      cells[z][x] = {
        x,
        z,
        wallNorth: true,
        wallSouth: true,
        wallEast: true,
        wallWest: true,
      }
    }
  }

  const visited = new Set<string>()
  const stack: [number, number][] = []
  const startX = Math.floor(rand() * CHUNK_CELLS)
  const startZ = Math.floor(rand() * CHUNK_CELLS)

  visited.add(`${startX},${startZ}`)
  stack.push([startX, startZ])

  const directions: [number, number, WallKey, WallKey][] = [
    [0, -1, 'wallNorth', 'wallSouth'],
    [0, 1, 'wallSouth', 'wallNorth'],
    [1, 0, 'wallEast', 'wallWest'],
    [-1, 0, 'wallWest', 'wallEast'],
  ]

  while (stack.length > 0) {
    const [curX, curZ] = stack[stack.length - 1]
    const unvisited = directions.filter(([dx, dz]) => {
      const nx = curX + (dx as number)
      const nz = curZ + (dz as number)
      return nx >= 0 && nx < CHUNK_CELLS && nz >= 0 && nz < CHUNK_CELLS && !visited.has(`${nx},${nz}`)
    })

    if (unvisited.length === 0) {
      stack.pop()
      continue
    }

    const [dx, dz, wall1, wall2] = unvisited[Math.floor(rand() * unvisited.length)]
    const nx = curX + (dx as number)
    const nz = curZ + (dz as number)

    setWall(cells[curZ][curX], wall1, false)
    setWall(cells[nz][nx], wall2, false)

    visited.add(`${nx},${nz}`)
    stack.push([nx, nz])
  }

  for (let z = 0; z < CHUNK_CELLS; z++) {
    for (let x = 0; x < CHUNK_CELLS; x++) {
      if (rand() < 0.3) {
        const dir = directions[Math.floor(rand() * directions.length)]
        const [dx, dz, wall1, wall2] = dir
        const nx = x + (dx as number)
        const nz = z + (dz as number)
        if (nx >= 0 && nx < CHUNK_CELLS && nz >= 0 && nz < CHUNK_CELLS) {
          setWall(cells[z][x], wall1, false)
          setWall(cells[nz][nx], wall2, false)
        }
      }
    }
  }

  openChunkBorders(cells, rand)

  return cells
}

function openChunkBorders(cells: MazeCell[][], rand: () => number) {
  const openings = 3
  for (let i = 0; i < openings; i++) {
    const idx = Math.floor(rand() * CHUNK_CELLS)
    cells[0][idx].wallNorth = false
    cells[CHUNK_CELLS - 1][idx].wallSouth = false
  }
  for (let i = 0; i < openings; i++) {
    const idx = Math.floor(rand() * CHUNK_CELLS)
    cells[idx][0].wallWest = false
    cells[idx][CHUNK_CELLS - 1].wallEast = false
  }
}

const chunkCache = new Map<string, ChunkData>()

export function getChunk(cx: number, cz: number): ChunkData {
  const key = `${cx},${cz}`
  if (chunkCache.has(key)) return chunkCache.get(key)!

  const cells = generateMazeChunk(cx, cz)
  const chunk: ChunkData = { cx, cz, cells }
  chunkCache.set(key, chunk)
  return chunk
}

export function worldToChunk(worldX: number, worldZ: number): [number, number] {
  const chunkWorldSize = CHUNK_CELLS * CELL_SIZE
  return [
    Math.floor(worldX / chunkWorldSize),
    Math.floor(worldZ / chunkWorldSize),
  ]
}

export { CHUNK_CELLS, CELL_SIZE }
