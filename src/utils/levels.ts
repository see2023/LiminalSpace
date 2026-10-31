import type { LevelType } from '../store/gameStore'

export interface LevelInfo {
  id: LevelType
  /** 英文短名（VR 调试面板用） */
  label: string
  /** 中文全名（切换提示用） */
  name: string
  /** 中文短名（演唱会面板的小按钮用） */
  short: string
  color: string
}

/** 场景顺序：VR 手柄 X（下一个）/ Y（上一个）按这个顺序循环切换 */
export const LEVELS: LevelInfo[] = [
  { id: 'backrooms', label: 'Backrooms', name: '后室 Backrooms', short: '后室', color: '#f0d060' },
  { id: 'poolrooms', label: 'Pool', name: '泳池 Poolrooms', short: '泳池', color: '#60c0f0' },
  { id: 'voidstation', label: 'Void', name: '虚空站 Void Station', short: '虚空站', color: '#8060f0' },
  { id: 'concert', label: 'Concert 360', name: '周杰伦演唱会 360°', short: '演唱会', color: '#ff5fa8' },
]

export function levelIndex(id: LevelType): number {
  return Math.max(0, LEVELS.findIndex((l) => l.id === id))
}

export function nextLevel(id: LevelType, step: 1 | -1): LevelInfo {
  return LEVELS[(levelIndex(id) + step + LEVELS.length) % LEVELS.length]
}
