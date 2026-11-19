import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let connected = false

export function setConnected(value: boolean) {
  if (connected === value) return
  connected = value
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useRealtimeConnected() {
  return useSyncExternalStore(subscribe, () => connected)
}
