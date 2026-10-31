import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import type { LevelType } from '../store/gameStore'

/** 有独立 BGM 的场景（演唱会自带视频声音，不放 BGM） */
type MusicScene = Exclude<LevelType, 'concert'>

const SCENE_TRACKS: Record<MusicScene, string> = {
  backrooms: '/audio/backrooms.mp3',
  poolrooms: '/audio/poolrooms.mp3',
  voidstation: '/audio/voidstation.mp3',
}

const MUSIC_SCENES = Object.keys(SCENE_TRACKS) as MusicScene[]

function hasMusic(level: LevelType): level is MusicScene {
  return level in SCENE_TRACKS
}

class SceneMusicPlayer {
  private tracks: Partial<Record<MusicScene, HTMLAudioElement>> = {}
  private current: MusicScene | null = null
  private unlocked = false

  constructor() {
    MUSIC_SCENES.forEach((scene) => {
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

  async play(scene: MusicScene) {
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
      if (hasMusic(currentLevel)) void player.play(currentLevel)
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
    if (hasMusic(currentLevel)) void player.play(currentLevel)
  }, [currentLevel])

  return null
}
