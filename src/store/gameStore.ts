import { createStore, useStore } from 'zustand'

export type LevelType = 'backrooms' | 'poolrooms' | 'voidstation'
export type InputMode = 'auto' | 'desktop' | 'mobile' | 'vr'

interface GameState {
  started: boolean
  currentLevel: LevelType
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

const gameStore = createStore<GameState>((set) => ({
  started: false,
  currentLevel: 'backrooms',
  transitioning: false,
  transitionTarget: null,
  inputMode: 'auto',
  detectedInputMode: detectInputMode(),

  start: () => set({ started: true }),
  setLevel: (level) => set({ currentLevel: level, transitioning: false, transitionTarget: null }),
  startTransition: (target) => set({ transitioning: true, transitionTarget: target }),
  endTransition: () => set((s) => ({
    currentLevel: s.transitionTarget ?? s.currentLevel,
    transitioning: false,
    transitionTarget: null,
  })),
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
