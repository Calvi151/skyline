import { create } from 'zustand'

interface BookingState {
  flightScheduleId: number | null
  setFlightScheduleId: (id: number | null) => void
}

export const useBookingStore = create<BookingState>((set) => ({
  flightScheduleId: null,
  setFlightScheduleId: (id) => set({ flightScheduleId: id }),
}))
