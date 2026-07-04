import type { HistoryEntry } from '../domain/scene/types'

export type HistoryState = {
  history: HistoryEntry[]
  future: HistoryEntry[]
}

export const emptyHistory: HistoryState = {
  history: [],
  future: [],
}
