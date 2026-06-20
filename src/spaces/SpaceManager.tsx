import { useGameStore } from '../store/gameStore'
import { BackroomsLevel } from './BackroomsLevel'
import { PoolRoomLevel } from './PoolRoomLevel'
import { VoidStationLevel } from './VoidStationLevel'
import { PlayerLight } from '../effects/PlayerLight'
import { WormholeTransition } from '../effects/WormholeTransition'

export function SpaceManager() {
  const currentLevel = useGameStore((s) => s.currentLevel)

  return (
    <>
      <PlayerLight />
      {currentLevel === 'backrooms' && <BackroomsLevel />}
      {currentLevel === 'poolrooms' && <PoolRoomLevel />}
      {currentLevel === 'voidstation' && <VoidStationLevel />}
      <WormholeTransition />
    </>
  )
}
