import { create } from 'zustand'

interface StaffState {
  selectedFlightId: number | null
  selectedGate: string
  cachedFlights: any[]
  setSelectedFlightId: (id: number | null) => void
  setSelectedGate: (gate: string) => void
  setCachedFlights: (flights: any[]) => void
}

const STORAGE_FLIGHT_KEY = 'skybook_staff_selected_flight_id'
const STORAGE_GATE_KEY = 'skybook_staff_selected_gate'

export const useStaffStore = create<StaffState>((set) => ({
  selectedFlightId: (() => {
    try {
      const val = localStorage.getItem(STORAGE_FLIGHT_KEY)
      return val ? Number(val) : null
    } catch {
      return null
    }
  })(),

  selectedGate: (() => {
    try {
      return localStorage.getItem(STORAGE_GATE_KEY) || 'all'
    } catch {
      return 'all'
    }
  })(),

  cachedFlights: [],

  setSelectedFlightId: (id: number | null) => {
    try {
      if (id !== null && !isNaN(id)) {
        localStorage.setItem(STORAGE_FLIGHT_KEY, String(id))
      } else {
        localStorage.removeItem(STORAGE_FLIGHT_KEY)
      }
    } catch {}
    set({ selectedFlightId: id })
  },

  setSelectedGate: (gate: string) => {
    try {
      localStorage.setItem(STORAGE_GATE_KEY, gate)
    } catch {}
    set({ selectedGate: gate })
  },

  setCachedFlights: (flights: any[]) => {
    set({ cachedFlights: flights })
  },
}))
