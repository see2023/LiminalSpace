import { useState, useRef, useEffect } from 'react'
import { useGameStore, getEffectiveInputMode } from '../store/gameStore'
import type { InputMode, LevelType } from '../store/gameStore'
import { APP_VERSION } from '../version'

export function DebugPanel() {
  const [open, setOpen] = useState(false)
  const [fps, setFps] = useState(0)
  const framesRef = useRef<number[]>([])
  const currentLevel = useGameStore((s) => s.currentLevel)
  const inputMode = useGameStore((s) => s.inputMode)
  const setInputMode = useGameStore((s) => s.setInputMode)
  const setLevel = useGameStore((s) => s.setLevel)

  useEffect(() => {
    let animId: number
    const tick = () => {
      framesRef.current.push(performance.now())
      const now = performance.now()
      framesRef.current = framesRef.current.filter((t) => now - t < 1000)
      setFps(framesRef.current.length)
      animId = requestAnimationFrame(tick)
    }
    animId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animId)
  }, [])

  const effectiveMode = getEffectiveInputMode()
  const levels: LevelType[] = ['backrooms', 'poolrooms', 'voidstation']
  const modes: InputMode[] = ['auto', 'desktop', 'mobile', 'vr']
  const webxrSamplesUrl = 'https://immersive-web.github.io/webxr-samples/'

  return (
    <div className="debug-panel">
      <button className="debug-toggle" onClick={() => setOpen(!open)}>
        {open ? '×' : `⚙ ${fps}`}
      </button>
      {open && (
        <div className="debug-content">
          <div className="debug-row">
            <span>Version</span>
            <span>{APP_VERSION}</span>
          </div>
          <div className="debug-row">
            <span>FPS</span>
            <span className={fps < 30 ? 'debug-warn' : ''}>{fps}</span>
          </div>
          <div className="debug-row">
            <span>Level</span>
            <span>{currentLevel}</span>
          </div>
          <div className="debug-row">
            <span>Input</span>
            <span>{inputMode} → {effectiveMode}</span>
          </div>
          <div className="debug-section">
            <label>Switch Input</label>
            <div className="debug-buttons">
              {modes.map((m) => (
                <button
                  key={m}
                  className={inputMode === m ? 'active' : ''}
                  onClick={() => setInputMode(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="debug-section">
            <label>Teleport to Level</label>
            <div className="debug-buttons">
              {levels.map((l) => (
                <button
                  key={l}
                  className={currentLevel === l ? 'active' : ''}
                  onClick={() => setLevel(l)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="debug-section">
            <label>WebXR Quick Test</label>
            <div className="debug-buttons">
              <button
                onClick={() => window.open(webxrSamplesUrl, '_blank', 'noopener,noreferrer')}
              >
                Open WebXR Samples
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
