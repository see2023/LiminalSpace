import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { BackroomsLevel } from './BackroomsLevel'
import { PoolRoomLevel } from './PoolRoomLevel'
import { VoidStationLevel } from './VoidStationLevel'
import { ConcertLevel } from './ConcertLevel'
import { PlayerLight } from '../effects/PlayerLight'
import { WormholeTransition } from '../effects/WormholeTransition'
import { concertVideo } from '../utils/concertVideo'

export function SpaceManager() {
  const currentLevel = useGameStore((s) => s.currentLevel)
  const transitionTarget = useGameStore((s) => s.transitionTarget)

  // 虫洞传送动画（2.6~3.8 秒）期间就开始加载视频，抵达时能更快出画面
  useEffect(() => {
    if (transitionTarget === 'concert') concertVideo.preload()
  }, [transitionTarget])

  return (
    <>
      {currentLevel !== 'concert' && <PlayerLight />}
      {currentLevel === 'backrooms' && <BackroomsLevel />}
      {currentLevel === 'poolrooms' && <PoolRoomLevel />}
      {currentLevel === 'voidstation' && <VoidStationLevel />}
      {currentLevel === 'concert' && <ConcertLevel />}
      <WormholeTransition />
    </>
  )
}
