import { createStore, useStore } from 'zustand'

export type LevelType = 'backrooms' | 'poolrooms' | 'voidstation' | 'concert'
export type InputMode = 'auto' | 'desktop' | 'mobile' | 'vr'

interface GameState {
  started: boolean
  currentLevel: LevelType
  /** 婕斿敱浼氾紙360掳 瑙嗛锛夐€€鍑哄悗杩斿洖鐨勫満鏅細璁板綍杩涘叆婕斿敱浼氫箣鍓嶆墍鍦ㄧ殑鍏冲崱 */
  returnLevel: LevelType
  transitioning: boolean
  transitionTarget: LevelType | null
  inputMode: InputMode
  detectedInputMode: 'desktop' | 'mobile'

  start: () => void
  setLevel: (level: LevelType) => void
  startTransition: (target: LevelType) => void
  endTransition: () => void
  setInputMode: (mode: InputMode) => void
}

function detectInputMode(): 'desktop' | 'mobile' {
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const hasPointer = window.matchMedia('(pointer: fine)').matches
  const isSmallScreen = window.innerWidth < 1024
  if (hasPointer && !isSmallScreen) return 'desktop'
  if (hasTouch && isSmallScreen) return 'mobile'
  return hasPointer ? 'desktop' : 'mobile'
}

/** 杩涘叆 concert 鏃惰浣忔潵婧愬叧鍗★紱鍏朵綑鎯呭喌淇濇寔鍘熷€?*/
function nextReturnLevel(state: GameState, next: LevelType): LevelType {
  if (next === 'concert' && state.currentLevel !== 'concert') return state.currentLevel
  return state.returnLevel
}

const gameStore = createStore<GameState>((set) => ({
  started: false,
  currentLevel: 'backrooms',
  returnLevel: 'backrooms',
  transitioning: false,
  transitionTarget: null,
  inputMode: 'auto',
  detectedInputMode: detectInputMode(),

  start: () => set({ started: true }),
  setLevel: (level) => set((s) => ({
    currentLevel: level,
    returnLevel: nextReturnLevel(s, level),
    transitioning: false,
    transitionTarget: null,
  })),
  startTransition: (target) => set({ transitioning: true, transitionTarget: target }),
  endTransition: () => set((s) => {
    const next = s.transitionTarget ?? s.currentLevel
    return {
      currentLevel: next,
      returnLevel: nextReturnLevel(s, next),
      transitioning: false,
      transitionTarget: null,
    }
  }),
  setInputMode: (mode) => set({ inputMode: mode }),
}))

export function useGameStore<T>(selector: (state: GameState) => T): T {
  return useStore(gameStore, selector)
}

export function getEffectiveInputMode(): 'desktop' | 'mobile' | 'vr' {
  const state = gameStore.getState()
  if (state.inputMode === 'auto') return state.detectedInputMode
  if (state.inputMode === 'vr') return 'vr'
  return state.inputMode
}

export { gameStore }
