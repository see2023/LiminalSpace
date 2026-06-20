import { useState, useCallback } from 'react'
import { useGameStore, getEffectiveInputMode } from '../store/gameStore'

const levelNames: Record<string, string> = {
  backrooms: 'Level 0 - The Backrooms',
  poolrooms: 'Level 37 - The Poolrooms',
  voidstation: 'The Void Station',
}

interface HUDProps {
  onEnterVR?: () => void
  vrSupported?: boolean
}

export function HUD({ onEnterVR, vrSupported }: HUDProps) {
  const currentLevel = useGameStore((s) => s.currentLevel)
  const started = useGameStore((s) => s.started)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [vrError, setVrError] = useState('')

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  const handleVR = useCallback(() => {
    setVrError('')
    if (onEnterVR) {
      try {
        onEnterVR()
      } catch (e) {
        setVrError(String(e))
      }
    } else {
      setVrError('VR not available')
    }
  }, [onEnterVR])

  if (!started) return null

  const mode = getEffectiveInputMode()
  const showCrosshair = mode === 'desktop'
  const isTouchDevice = 'ontouchstart' in window

  return (
    <div className="hud-overlay">
      {showCrosshair && <div className="crosshair" />}
      <div className="level-indicator">
        {levelNames[currentLevel] ?? currentLevel}
      </div>
      <div className="hud-buttons">
        <button className="hud-btn" onClick={toggleFullscreen}>
          {isFullscreen ? '退出全屏' : '全屏'}
        </button>
        {(vrSupported || isTouchDevice) && (
          <button className="hud-btn hud-btn-vr" onClick={handleVR}>
            360° VR
          </button>
        )}
      </div>
      {vrError && <div className="vr-error">{vrError}</div>}
    </div>
  )
}
