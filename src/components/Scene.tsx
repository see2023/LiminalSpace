import { Canvas } from '@react-three/fiber'
import { XR, createXRStore } from '@react-three/xr'
import { SpaceManager } from '../spaces/SpaceManager'
import { FPSControls } from './FPSControls'
import { VRLocomotion, VRDebugHUD } from './VRLocomotion'
import { HUD } from './HUD'
import { StartScreen } from './StartScreen'
import { MobileControls } from './MobileControls'
import { DebugPanel } from './DebugPanel'
import { SceneAudio } from '../effects/SceneAudio'
import { useState, useEffect, useCallback } from 'react'
import { useGameStore, getEffectiveInputMode } from '../store/gameStore'

const xrStore = createXRStore({
  hand: false,
  controller: true,
  transientPointer: false,
  screenInput: false,
})

export function Scene() {
  const [vrSupported, setVrSupported] = useState(false)
  const started = useGameStore((s) => s.started)
  const inputMode = useGameStore((s) => s.inputMode)

  useEffect(() => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then(setVrSupported).catch(() => {})
    }
  }, [])

  const handleEnterVR = useCallback(() => {
    xrStore.enterVR()
  }, [])

  const showMobile = started && (getEffectiveInputMode() === 'mobile' || inputMode === 'mobile')

  return (
    <>
      <StartScreen />
      <HUD onEnterVR={handleEnterVR} vrSupported={vrSupported} />
      {showMobile && <MobileControls />}
      <DebugPanel />
      <SceneAudio />
      <Canvas
        gl={{ antialias: true, alpha: false }}
        camera={{ fov: 70, near: 0.1, far: 100, position: [6, 1.6, 6] }}
        style={{ position: 'fixed', top: 0, left: 0 }}
      >
        <XR store={xrStore}>
          <SpaceManager />
          <FPSControls />
          <VRLocomotion />
          <VRDebugHUD />
        </XR>
      </Canvas>
    </>
  )
}
