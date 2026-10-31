import { gameStore } from '../store/gameStore'
import { concertVideo } from './concertVideo'

/** 离开演唱会：立即暂停视频，并通过虫洞传送回进入前的场景 */
export function leaveConcert() {
  const { transitioning, returnLevel, startTransition } = gameStore.getState()
  if (transitioning) return
  concertVideo.pause()
  startTransition(returnLevel === 'concert' ? 'backrooms' : returnLevel)
}
