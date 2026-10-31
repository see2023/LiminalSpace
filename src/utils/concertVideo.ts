import { useSyncExternalStore } from 'react'
import { remoteLog } from './remoteLog'

/**
 * 演唱会场景的 360° 视频控制器（单例）。
 *
 * - 视频放在 public/video/ 下（不入库，见 .gitignore），格式：H.264 + AAC 的 MP4，
 *   单眼等距柱状（equirectangular，2:1）。H.264 在 Pico 3 / Pico 4 浏览器可硬解。
 * - 3D 场景（VideoTexture）、桌面/移动端 DOM 控制条、VR 内控制面板共用同一个 <video>，
 *   通过 useConcertVideoState() 订阅播放状态。
 */

export const CONCERT_TITLE = '周杰伦 2022 嘉年华演唱会 · 新加坡站（3）'
export const CONCERT_VIDEO_FILE = 'jay-2022-singapore-3.mp4'
export const CONCERT_VIDEO_URL = `${import.meta.env.BASE_URL}video/${CONCERT_VIDEO_FILE}`
export const SEEK_STEP_SHORT = 10
export const SEEK_STEP_LONG = 30

export interface ConcertState {
  /** 已有可渲染的画面（readyState >= HAVE_CURRENT_DATA） */
  hasFrame: boolean
  /** 想播放但数据不够，正在缓冲 */
  buffering: boolean
  playing: boolean
  ended: boolean
  muted: boolean
  /** 浏览器拦截了带声音的自动播放，已降级为静音播放，需要用户操作后开启声音 */
  audioBlocked: boolean
  currentTime: number
  duration: number
  /** 当前播放位置之后已缓冲到的秒数位置 */
  bufferedEnd: number
  error: string | null
}

const initialState: ConcertState = {
  hasFrame: false,
  buffering: false,
  playing: false,
  ended: false,
  muted: false,
  audioBlocked: false,
  currentTime: 0,
  duration: 0,
  bufferedEnd: 0,
  error: null,
}

let state: ConcertState = initialState
const listeners = new Set<() => void>()

let video: HTMLVideoElement | null = null
/** 用户（或场景）希望正在播放；用于区分“暂停”与“缓冲中” */
let wantPlay = false
let audioBlocked = false

function emit(patch: Partial<ConcertState>) {
  let changed = false
  for (const key of Object.keys(patch) as (keyof ConcertState)[]) {
    if (state[key] !== patch[key]) {
      changed = true
      break
    }
  }
  if (!changed) return
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function bufferedEndOf(v: HTMLVideoElement): number {
  const ranges = v.buffered
  const t = v.currentTime
  for (let i = 0; i < ranges.length; i++) {
    if (t >= ranges.start(i) - 0.25 && t <= ranges.end(i) + 0.25) return ranges.end(i)
  }
  return t
}

function describeError(v: HTMLVideoElement): string {
  const code = v.error?.code
  if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return `找不到视频文件或格式不支持：请确认 public/video/${CONCERT_VIDEO_FILE} 存在（H.264 + AAC 的 MP4）`
  }
  if (code === MediaError.MEDIA_ERR_NETWORK) return '视频下载中断，请检查网络后重试'
  if (code === MediaError.MEDIA_ERR_DECODE) return '视频解码失败（设备可能不支持该编码）'
  return '视频加载失败'
}

function sync() {
  const v = video
  if (!v) return
  emit({
    hasFrame: v.readyState >= 2,
    buffering: wantPlay && !v.error && !v.ended && v.readyState < 3,
    playing: !v.paused && !v.ended,
    ended: v.ended,
    muted: v.muted,
    audioBlocked,
    currentTime: v.currentTime,
    duration: Number.isFinite(v.duration) ? v.duration : 0,
    bufferedEnd: bufferedEndOf(v),
    error: v.error ? describeError(v) : null,
  })
}

function ensureVideo(): HTMLVideoElement {
  if (video) return video

  const v = document.createElement('video')
  v.crossOrigin = 'anonymous'
  v.playsInline = true
  v.setAttribute('playsinline', '')
  v.setAttribute('webkit-playsinline', '')
  // 不要让浏览器给这个隐藏的 <video> 弹出画中画 / 投屏 / 系统播放器入口（头显浏览器可能把它当普通视频接管）
  v.disablePictureInPicture = true
  v.setAttribute('disableRemotePlayback', '')
  v.controls = false
  v.preload = 'auto'
  v.loop = false
  // 不放进可见区域，但挂到 DOM 上，避免部分移动端浏览器对游离 <video> 限流
  Object.assign(v.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '2px',
    height: '2px',
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '-1',
  })

  const events = [
    'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'waiting', 'stalled',
    'playing', 'pause', 'ended', 'timeupdate', 'progress', 'seeked', 'volumechange',
    'durationchange', 'error', 'emptied',
  ]
  events.forEach((name) => v.addEventListener(name, sync))

  // 关键事件回传到 yarn dev 终端 / vr-errors.log，方便在 Pico 上排查（卡顿事件限频，避免刷屏）
  let lastWaitingLog = 0
  v.addEventListener('loadedmetadata', () => {
    remoteLog('info', `[Concert] metadata: ${v.videoWidth}x${v.videoHeight}, ${v.duration.toFixed(0)}s, src=${v.currentSrc}`)
  })
  v.addEventListener('playing', () => {
    remoteLog('info', `[Concert] playing at ${v.currentTime.toFixed(1)}s, muted=${v.muted}, readyState=${v.readyState}`)
  })
  v.addEventListener('waiting', () => {
    const now = performance.now()
    if (now - lastWaitingLog < 5000) return
    lastWaitingLog = now
    remoteLog('warn', `[Concert] buffering at ${v.currentTime.toFixed(1)}s, readyState=${v.readyState}, networkState=${v.networkState}`)
  })
  v.addEventListener('error', () => {
    remoteLog('error', `[Concert] video error code=${v.error?.code} message="${v.error?.message ?? ''}" networkState=${v.networkState} src=${v.currentSrc}`)
  })

  v.src = CONCERT_VIDEO_URL
  document.body.appendChild(v)
  video = v
  sync()
  return v
}

async function startPlayback() {
  const v = ensureVideo()
  wantPlay = true
  if (v.error) {
    // 之前加载失败（例如文件刚放进去）：重新加载一次
    v.load()
  }
  if (v.ended) v.currentTime = 0

  try {
    await v.play()
  } catch (err) {
    const name = err instanceof DOMException ? err.name : ''
    if (name === 'NotAllowedError' && !v.muted) {
      // 带声音的自动播放被拦截：降级为静音播放，等用户操作后再开声音
      v.muted = true
      audioBlocked = true
      remoteLog('warn', '[Concert] autoplay with sound blocked, falling back to muted playback')
      try {
        await v.play()
      } catch (err2) {
        wantPlay = false
        remoteLog('warn', `[Concert] muted autoplay also rejected: ${err2 instanceof Error ? err2.name : err2}`)
      }
    } else if (name !== 'AbortError') {
      wantPlay = false
      remoteLog('warn', `[Concert] play() rejected: ${err instanceof Error ? `${err.name}: ${err.message}` : err}`)
    }
  }
  sync()
}

/** 想播放（wantPlay）却被系统暂停了（头显戴上/摘下、进出 VR 会话导致页面可见性变化）：恢复播放 */
function ensurePlaying() {
  if (!wantPlay || !video) return
  if (video.paused && !video.ended) void startPlayback()
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') ensurePlaying()
  })
}

export const concertVideo = {
  /** 进出 VR 会话后调用：想播放却被暂停时恢复播放 */
  ensurePlaying,

  /** 提前开始加载（例如虫洞传送动画期间），不播放 */
  preload() {
    ensureVideo()
  },

  /** 进入演唱会场景：从上次的位置继续播放 */
  enter() {
    void startPlayback()
  },

  /** 离开演唱会场景：暂停并保留进度 */
  leave() {
    wantPlay = false
    video?.pause()
    sync()
  },

  play() {
    void startPlayback()
  },

  pause() {
    wantPlay = false
    video?.pause()
    sync()
  },

  toggle() {
    const v = ensureVideo()
    if (v.paused || v.ended) {
      void startPlayback()
    } else {
      concertVideo.pause()
    }
  },

  seekBy(seconds: number) {
    const v = ensureVideo()
    const max = Number.isFinite(v.duration) ? v.duration : Infinity
    v.currentTime = Math.max(0, Math.min(max - 0.1, v.currentTime + seconds))
    sync()
  },

  seekToFraction(fraction: number) {
    const v = ensureVideo()
    if (!Number.isFinite(v.duration)) return
    v.currentTime = Math.max(0, Math.min(v.duration - 0.1, fraction * v.duration))
    sync()
  },

  toggleMute() {
    const v = ensureVideo()
    if (audioBlocked) {
      audioBlocked = false
      v.muted = false
    } else {
      v.muted = !v.muted
    }
    sync()
  },

  /** 在用户手势中调用：如果之前因自动播放策略被静音，则恢复声音 */
  unlockAudio() {
    if (!audioBlocked || !video) return
    audioBlocked = false
    video.muted = false
    sync()
  },

  getElement(): HTMLVideoElement {
    return ensureVideo()
  },
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useConcertVideoState(): ConcertState {
  return useSyncExternalStore(subscribe, () => state)
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const s = Math.floor(seconds)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}
