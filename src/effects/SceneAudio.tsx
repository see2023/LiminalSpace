import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

type SceneType = 'backrooms' | 'poolrooms' | 'voidstation'

const SCENE_TRACKS: Record<SceneType, string> = {
  backrooms: '/audio/backrooms.mp3',
  poolrooms: '/audio/poolrooms.mp3',
  voidstation: '/audio/voidstation.mp3',
}

class SceneMusicPlayer {
  private tracks: Partial<Record<SceneType, HTMLAudioElement>> = {}
  private current: SceneType | null = null
  private unlocked = false

  constructor() {
    ;(['backrooms', 'poolrooms', 'voidstation'] as SceneType[]).forEach((scene) => {
      const audio = new Audio(SCENE_TRACKS[scene])
      audio.loop = true
      audio.preload = 'auto'
      audio.volume = 0.35
      this.tracks[scene] = audio
    })
  }

  unlock() {
    this.unlocked = true
  }

  async play(scene: SceneType) {
    if (!this.unlocked || this.current === scene) return

    const prev = this.current ? this.tracks[this.current] : null
    if (prev) {
      prev.pause()
      prev.currentTime = 0
    }

    const next = this.tracks[scene]
    this.current = scene
    if (!next) return

    try {
      await next.play()
    } catch {
      // Ignore autoplay rejections until next user interaction.
    }
  }

  stopAll() {
    Object.values(this.tracks).forEach((audio) => {
      if (!audio) return
      audio.pause()
      audio.currentTime = 0
    })
    this.current = null
  }
}

const player = new SceneMusicPlayer()

export function SceneAudio() {
  const currentLevel = useGameStore((s) => s.currentLevel)

  useEffect(() => {
    const handleUserGesture = () => {
      player.unlock()
      void player.play(currentLevel as SceneType)
    }

    window.addEventListener('pointerdown', handleUserGesture)
    window.addEventListener('keydown', handleUserGesture)
    window.addEventListener('touchstart', handleUserGesture)
    window.addEventListener('click', handleUserGesture)

    return () => {
      window.removeEventListener('pointerdown', handleUserGesture)
      window.removeEventListener('keydown', handleUserGesture)
      window.removeEventListener('touchstart', handleUserGesture)
      window.removeEventListener('click', handleUserGesture)
      player.stopAll()
    }
  }, [currentLevel])

  useEffect(() => {
    void player.play(currentLevel as SceneType)
  }, [currentLevel])

  return null
}
