import { useEffect, useRef, useCallback } from 'react'
import nipplejs from 'nipplejs'
import { mobileInput } from '../store/inputState'
import { useGameStore } from '../store/gameStore'

export function MobileControls() {
  const started = useGameStore((s) => s.started)
  const joystickZoneRef = useRef<HTMLDivElement>(null)
  const lookZoneRef = useRef<HTMLDivElement>(null)
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!started || !joystickZoneRef.current) return

    const manager = nipplejs.create({
      zone: joystickZoneRef.current,
      mode: 'semi',
      catchDistance: 80,
      color: 'rgba(255, 255, 255, 0.3)',
      size: 120,
      restOpacity: 0.4,
    })

    manager.on('move', (_, data) => {
      if (data.vector) {
        mobileInput.moveX = data.vector.x
        mobileInput.moveY = -data.vector.y
        mobileInput.active = true
      }
    })

    manager.on('end', () => {
      mobileInput.moveX = 0
      mobileInput.moveY = 0
      mobileInput.active = false
    })

    return () => {
      manager.destroy()
      mobileInput.moveX = 0
      mobileInput.moveY = 0
      mobileInput.active = false
    }
  }, [started])

  const handleLookTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    lastTouchRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const handleLookTouchMove = useCallback((e: React.TouchEvent) => {
    if (!lastTouchRef.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - lastTouchRef.current.x
    const dy = touch.clientY - lastTouchRef.current.y
    mobileInput.lookX = dx * 0.4
    mobileInput.lookY = dy * 0.4
    lastTouchRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const handleLookTouchEnd = useCallback(() => {
    lastTouchRef.current = null
    mobileInput.lookX = 0
    mobileInput.lookY = 0
  }, [])

  if (!started) return null

  return (
    <div className="mobile-controls">
      <div ref={joystickZoneRef} className="joystick-zone" />
      <div
        ref={lookZoneRef}
        className="look-zone"
        onTouchStart={handleLookTouchStart}
        onTouchMove={handleLookTouchMove}
        onTouchEnd={handleLookTouchEnd}
      />
    </div>
  )
}
