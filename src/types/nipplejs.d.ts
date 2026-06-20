declare module 'nipplejs' {
  interface JoystickOptions {
    zone?: HTMLElement
    mode?: 'dynamic' | 'static' | 'semi'
    catchDistance?: number
    color?: string
    size?: number
    restOpacity?: number
    position?: { top?: string; left?: string; bottom?: string; right?: string }
    multitouch?: boolean
    shape?: 'circle' | 'square'
    follow?: boolean
  }

  interface JoystickData {
    angle: { radian: number; degree: number }
    direction: { x: string; y: string; angle: string }
    distance: number
    force: number
    position: { x: number; y: number }
    pressure: number
    vector: { x: number; y: number }
  }

  interface JoystickManager {
    on(event: 'start' | 'end' | 'move' | 'dir' | 'plain', callback: (evt: unknown, data: JoystickData) => void): void
    off(event: string, callback: (...args: unknown[]) => void): void
    destroy(): void
  }

  interface NippleJS {
    create(options?: JoystickOptions): JoystickManager
  }

  const nipplejs: NippleJS
  export default nipplejs
}
