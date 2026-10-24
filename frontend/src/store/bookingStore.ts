import { create } from 'zustand'

export interface PassengerData {
  full_name: string
  id_number: string
  birth_date: string
  gender: 'male' | 'female'
  seat_id?: number | null
  seat_number?: string | null
  seat_class: 'economy' | 'business'
  baggage_option_id?: number | null
  baggage_name?: string | null
  baggage_price?: number
}

interface BookingState {
  flightScheduleId: number | null
  selectedFlight: any | null
  passengersCount: number
  cabinClass: 'economy' | 'business'
  currentStep: 1 | 2
  passengers: PassengerData[]
  activePassengerIndex: number
  setFlightScheduleId: (id: number | null) => void
  setSelectedFlight: (flight: any) => void
  setPassengersCount: (count: number) => void
  setCabinClass: (cls: 'economy' | 'business') => void
  setCurrentStep: (step: 1 | 2) => void
  setPassengers: (passengers: PassengerData[]) => void
  updatePassenger: (index: number, patch: Partial<PassengerData>) => void
  setActivePassengerIndex: (index: number) => void
  resetBooking: () => void
}

export const useBookingStore = create<BookingState>((set) => ({
  flightScheduleId: null,
  selectedFlight: null,
  passengersCount: 1,
  cabinClass: 'economy',
  currentStep: 1,
  passengers: [
    {
      full_name: '',
      id_number: '',
      birth_date: '',
      gender: 'male',
      seat_class: 'economy',
      seat_id: null,
      seat_number: null,
      baggage_option_id: null,
      baggage_name: null,
      baggage_price: 0,
    },
  ],
  activePassengerIndex: 0,
  setFlightScheduleId: (id) => set({ flightScheduleId: id }),
  setSelectedFlight: (flight) => set({ selectedFlight: flight }),
  setPassengersCount: (count) => set({ passengersCount: count }),
  setCabinClass: (cls) => set({ cabinClass: cls }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setPassengers: (passengers) => set({ passengers }),
  updatePassenger: (index, patch) =>
    set((state) => {
      const next = [...state.passengers]
      next[index] = { ...next[index], ...patch }
      return { passengers: next }
    }),
  setActivePassengerIndex: (index) => set({ activePassengerIndex: index }),
  resetBooking: () =>
    set({
      flightScheduleId: null,
      selectedFlight: null,
      passengersCount: 1,
      cabinClass: 'economy',
      currentStep: 1,
      passengers: [
        {
          full_name: '',
          id_number: '',
          birth_date: '',
          gender: 'male',
          seat_class: 'economy',
          seat_id: null,
          seat_number: null,
          baggage_option_id: null,
          baggage_name: null,
          baggage_price: 0,
        },
      ],
      activePassengerIndex: 0,
    }),
}))
