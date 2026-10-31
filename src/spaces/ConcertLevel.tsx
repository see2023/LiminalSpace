import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import * as THREE from 'three'
import { concertVideo } from '../utils/concertVideo'
import { remoteLog } from '../utils/remoteLog'
import { ConcertVRPanel } from '../components/ConcertVRPanel'

/** 全景球半径：要小于相机 far（100），并远大于任何近处物体 */
const SPHERE_RADIUS = 50

/**
 * 让视频画面正中央（全景相机的正前方）正对玩家出生时的朝向（-Z）。
 * SphereGeometry 经 scale(-1,1,1) 翻转后，u=0.5（画面中心）位于 -X，
 * 绕 Y 轴旋转 -90° 即可转到 -Z。
 */
const FRONT_YAW = -Math.PI / 2

/** 视频帧上传次数（供 VR 诊断日志统计 uploads/s） */
const stats = { uploads: 0 }

/**
 * 视频纹理必须在 effect 里创建，并与 dispose 成对出现。
 * three 的 VideoTexture.dispose() 会取消内部的 requestVideoFrameCallback 循环且不会重新注册；
 * 如果在 render 阶段 useMemo 创建，React StrictMode 的“挂载→清理→再挂载”会让同一个
 * 已 dispose 的纹理继续被使用，画面就永远停在黑屏。
 */
function useVideoTexture(video: HTMLVideoElement): THREE.VideoTexture | null {
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null)

  useEffect(() => {
    const t = new THREE.VideoTexture(video)
    t.colorSpace = THREE.SRGBColorSpace
    t.minFilter = THREE.LinearFilter
    t.magFilter = THREE.LinearFilter
    t.generateMipmaps = false
    setTexture(t)
    return () => t.dispose()
  }, [video])

  return texture
}

/**
 * 360° 全景视频球。
 * 球心始终跟随头部（相机）世界坐标：单眼全景没有深度信息，
 * 头部平移时画面应像天空盒一样“无限远”，不能出现视差。
 */
function PanoramaSphere() {
  const groupRef = useRef<THREE.Group>(null)
  const video = concertVideo.getElement()
  const texture = useVideoTexture(video)
  const uploaded = useRef<{ texture: THREE.VideoTexture | null; time: number }>({ texture: null, time: -1 })

  const geometry = useMemo(() => {
    const g = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 40)
    // 翻转 X，让三角面朝内，并保证从球内看画面不是镜像
    g.scale(-1, 1, 1)
    return g
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    if (groupRef.current) {
      camera.getWorldPosition(tmp)
      groupRef.current.position.copy(tmp)
    }

    // 手动驱动视频帧上传：three 的 VideoTexture 只靠 video.requestVideoFrameCallback 更新，
    // 而 WebXR 沉浸会话里（Pico / Quest 浏览器）这个回调可能不再触发，纹理就停在第一帧 → VR 里黑屏。
    // useFrame 在 XR 会话里随头显帧率运行，在这里直接标记更新最稳。
    if (!texture) return
    const u = uploaded.current
    if (u.texture !== texture) {
      u.texture = texture
      u.time = -1
    }
    if (video.readyState < 2 || video.seeking) return
    const t = video.currentTime
    // 播放中每帧上传；暂停时只在进度变化（拖动进度条）后上传一次，避免白白占用 GPU 带宽
    if (!video.paused || t !== u.time) {
      texture.needsUpdate = true
      u.time = t
      stats.uploads++
    }
  })

  return (
    <group ref={groupRef}>
      {texture && (
        <mesh geometry={geometry} rotation={[0, FRONT_YAW, 0]} renderOrder={-1000} frustumCulled={false}>
          <meshBasicMaterial map={texture} toneMapped={false} depthWrite={false} fog={false} />
        </mesh>
      )}
    </group>
  )
}

/**
 * VR 诊断：进入 VR 会话后，每 5 秒往 yarn dev 终端 / vr-errors.log 打一行视频状态（共约 50 秒）。
 * 包含：播放进度、可见性、每秒上传帧数、rVFC 每秒回调数、当前帧平均亮度（0~255，接近 0 说明视频本身此刻就是黑的）。
 */
function XRVideoDiagnostics() {
  const inXR = useXR((s) => s.session != null)

  useEffect(() => {
    if (!inXR) return
    const video = concertVideo.getElement()

    let rvfcCount = 0
    let rvfcId = 0
    const hasRvfc = 'requestVideoFrameCallback' in video
    const tick = () => {
      rvfcCount++
      rvfcId = video.requestVideoFrameCallback(tick)
    }
    if (hasRvfc) rvfcId = video.requestVideoFrameCallback(tick)

    const probe = document.createElement('canvas')
    probe.width = 32
    probe.height = 16
    const pctx = probe.getContext('2d', { willReadFrequently: true })
    const luma = (): number => {
      if (!pctx || video.readyState < 2) return -1
      try {
        pctx.drawImage(video, 0, 0, probe.width, probe.height)
        const data = pctx.getImageData(0, 0, probe.width, probe.height).data
        let sum = 0
        for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
        return Math.round(sum / (data.length / 4))
      } catch {
        return -1
      }
    }

    const INTERVAL = 5
    let lastUploads = stats.uploads
    let lastRvfc = 0
    let logs = 0
    const log = () => {
      const uploads = (stats.uploads - lastUploads) / INTERVAL
      const rvfc = (rvfcCount - lastRvfc) / INTERVAL
      lastUploads = stats.uploads
      lastRvfc = rvfcCount
      remoteLog(
        'info',
        `[Concert][XR] t=${video.currentTime.toFixed(1)}s paused=${video.paused} ready=${video.readyState} ` +
          `size=${video.videoWidth}x${video.videoHeight} vis=${document.visibilityState} ` +
          `uploads/s=${uploads.toFixed(1)} rVFC/s=${hasRvfc ? rvfc.toFixed(1) : 'n/a'} luma=${luma()}`,
      )
      if (++logs >= 10) window.clearInterval(timer)
    }
    const timer = window.setInterval(log, INTERVAL * 1000)

    return () => {
      window.clearInterval(timer)
      if (hasRvfc) video.cancelVideoFrameCallback(rvfcId)
    }
  }, [inXR])

  return null
}

/**
 * 演唱会：360° 全景视频场景。
 * 玩家固定在原地环顾（桌面鼠标 / 手机触摸 / VR 头部追踪），不可移动；
 * 进入时从上次进度继续播放，离开时暂停。
 */
export function ConcertLevel() {
  const { scene } = useThree()
  const inXR = useXR((s) => s.session != null)

  useEffect(() => {
    scene.background = new THREE.Color('#000000')
    scene.fog = null
    return () => {
      scene.background = null
    }
  }, [scene])

  useEffect(() => {
    concertVideo.enter()
    return () => concertVideo.leave()
  }, [])

  // 进入 / 退出 VR 会话时，系统可能顺手把视频暂停了（页面可见性变化）：想播放却暂停时恢复，并尝试恢复声音
  useEffect(() => {
    concertVideo.unlockAudio()
    concertVideo.ensurePlaying()
    const id = window.setTimeout(() => concertVideo.ensurePlaying(), 1500)
    return () => window.clearTimeout(id)
  }, [inXR])

  return (
    <>
      <PanoramaSphere />
      <ConcertVRPanel />
      <XRVideoDiagnostics />
    </>
  )
}
