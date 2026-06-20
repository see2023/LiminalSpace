import { useCallback } from 'react'
import { useGameStore, getEffectiveInputMode } from '../store/gameStore'

export function StartScreen() {
  const started = useGameStore((s) => s.started)
  const start = useGameStore((s) => s.start)

  const handleClick = useCallback(() => {
    start()
    if (getEffectiveInputMode() === 'desktop') {
      const canvas = document.querySelector('canvas')
      if (canvas) canvas.requestPointerLock()
    }
  }, [start])

  if (started) return null

  return (
    <div className="start-screen" onClick={handleClick}>
      <h1>阈限空间</h1>
      <h2>LIMINAL SPACE</h2>
      <p className="prompt">点击画面开始探索</p>
      <div className="controls-hint">
        WASD / 方向键 移动 &nbsp;|&nbsp; 鼠标 环顾四周 &nbsp;|&nbsp; ESC 释放鼠标
        <br />
        移动端：左侧摇杆移动 &nbsp;|&nbsp; 右侧滑动旋转视角
        <br />
        寻找发光的传送门穿越到不同空间
      </div>
    </div>
  )
}
