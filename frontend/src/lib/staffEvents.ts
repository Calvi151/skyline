/**
 * Staff Realtime Event Bus
 * Uses native BroadcastChannel with localStorage storage-event fallback for cross-tab synchronization.
 */

export interface StaffRealtimeEvent {
  type: 'BOARDING_STATUS_CHANGED' | 'FLIGHT_UPDATED' | 'GATE_STATUS_CHANGED' | 'REFRESH_ALL'
  flightId?: number
  checkInId?: number
  newStatus?: string
  gate?: string
  timestamp: number
}

const CHANNEL_NAME = 'skybook_staff_realtime_channel'
const STORAGE_KEY = 'skybook_staff_realtime_event'

let channel: BroadcastChannel | null = null
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME)
  }
} catch {
  channel = null
}

/**
 * Broadcast event ke semua tab/jendela staf yang sedang aktif
 */
export function broadcastStaffEvent(event: Omit<StaffRealtimeEvent, 'timestamp'>) {
  const fullEvent: StaffRealtimeEvent = {
    ...event,
    timestamp: Date.now(),
  }

  try {
    channel?.postMessage(fullEvent)
  } catch (err) {
    console.warn('Gagal broadcast via BroadcastChannel:', err)
  }

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fullEvent))
    }
  } catch (err) {
    console.warn('Gagal simpan event ke localStorage:', err)
  }
}

/**
 * Subscribe ke event realtime staf dari tab/jendela lain
 */
export function subscribeStaffEvents(callback: (event: StaffRealtimeEvent) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleMessage = (event: MessageEvent<StaffRealtimeEvent>) => {
    if (event.data && event.data.type) {
      callback(event.data)
    }
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        const parsed: StaffRealtimeEvent = JSON.parse(event.newValue)
        callback(parsed)
      } catch {}
    }
  }

  channel?.addEventListener('message', handleMessage)
  window.addEventListener('storage', handleStorage)

  return () => {
    channel?.removeEventListener('message', handleMessage)
    window.removeEventListener('storage', handleStorage)
  }
}
