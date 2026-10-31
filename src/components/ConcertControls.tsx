import { useEffect, useState } from 'react'
import { getEffectiveInputMode, useGameStore } from '../store/gameStore'
import {
  CONCERT_TITLE,
  SEEK_STEP_SHORT,
  concertVideo,
  formatTime,
  useConcertVideoState,
} from '../utils/concertVideo'
import { leaveConcert } from '../utils/concertActions'

/**
 * 演唱会场景的桌面 / 手机端控制条（VR 内使用 ConcertVRPanel）。
 * 键盘：空格 播放/暂停，←/→ 快退/快进 10 秒，M 静音，Q 离开。
 */
export function ConcertControls() {
  const started = useGameStore((s) => s.started)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const transitioning = useGameStore((s) => s.transitioning)
  const video = useConcertVideoState()
  const [dragFraction, setDragFraction] = useState<number | null>(null)

  const active = started && currentLevel === 'concert' && !transitioning

  useEffect(() => {
    if (!active) return

    const onKeyDown = (e: KeyboardEvent) => {
      concertVideo.unlockAudio()
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          concertVideo.toggle()
          break
        case 'ArrowLeft':
          e.preventDefault()
          concertVideo.seekBy(-SEEK_STEP_SHORT)
          break
        case 'ArrowRight':
          e.preventDefault()
          concertVideo.seekBy(SEEK_STEP_SHORT)
          break
        case 'KeyM':
          concertVideo.toggleMute()
          break
        case 'KeyQ':
          leaveConcert()
          break
      }
    }
    // 任意用户手势都可以恢复被自动播放策略静音的声音
    const onGesture = () => concertVideo.unlockAudio()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('touchend', onGesture)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('touchend', onGesture)
    }
  }, [active])

  if (!active) return null

  const isMobile = getEffectiveInputMode() === 'mobile'
  const fraction = dragFraction ?? (video.duration > 0 ? video.currentTime / video.duration : 0)
  const shownTime = dragFraction !== null ? dragFraction * video.duration : video.currentTime

  let status: string | null = null
  if (video.error) status = video.error
  else if (!video.hasFrame) status = '视频加载中…'
  else if (video.buffering) status = '缓冲中…'
  else if (video.audioBlocked) status = '浏览器限制了自动播放声音，点击任意位置或「开声音」'

  const commitSeek = () => {
    if (dragFraction !== null) concertVideo.seekToFraction(dragFraction)
    setDragFraction(null)
  }

  return (
    <div className="concert-controls">
      {status && (
        <div className={`concert-status${video.error ? ' concert-status-error' : ''}`}>{status}</div>
      )}
      <div className="concert-bar">
        <div className="concert-title">{CONCERT_TITLE}</div>
        <div className="concert-row">
          <button
            className="concert-btn concert-btn-primary"
            onClick={(e) => {
              concertVideo.toggle()
              e.currentTarget.blur()
            }}
          >
            {video.playing ? '暂停' : video.ended ? '重播' : '播放'}
          </button>
          <button
            className="concert-btn"
            onClick={(e) => {
              concertVideo.seekBy(-SEEK_STEP_SHORT)
              e.currentTarget.blur()
            }}
          >
            -{SEEK_STEP_SHORT}s
          </button>
          <button
            className="concert-btn"
            onClick={(e) => {
              concertVideo.seekBy(SEEK_STEP_SHORT)
              e.currentTarget.blur()
            }}
          >
            +{SEEK_STEP_SHORT}s
          </button>
          <span className="concert-time">
            {formatTime(shownTime)} / {formatTime(video.duration)}
          </span>
          <input
            className="concert-seek"
            type="range"
            min={0}
            max={1000}
            value={Math.round(fraction * 1000)}
            onChange={(e) => setDragFraction(Number(e.target.value) / 1000)}
            onPointerUp={(e) => {
              commitSeek()
              e.currentTarget.blur()
            }}
            onKeyUp={(e) => e.currentTarget.blur()}
          />
          <button
            className="concert-btn"
            onClick={(e) => {
              concertVideo.toggleMute()
              e.currentTarget.blur()
            }}
          >
            {video.muted ? '开声音' : '静音'}
          </button>
          <button
            className="concert-btn concert-btn-exit"
            onClick={(e) => {
              leaveConcert()
              e.currentTarget.blur()
            }}
          >
            离开
          </button>
        </div>
        <div className="concert-hint">
          {isMobile
            ? '滑动屏幕环顾四周 · 戴 Pico 请点右下角「360° VR」'
            : '空格 播放/暂停 · ←/→ 快退/快进 10 秒 · M 静音 · Q 离开 · 鼠标环顾 · ESC 释放鼠标后可点按钮'}
        </div>
      </div>
    </div>
  )
}
