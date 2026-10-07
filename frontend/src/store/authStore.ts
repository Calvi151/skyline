import { create } from 'zustand'

export interface AuthUser {
  id: number
  name: string
  email: string
  role: 'admin' | 'staff' | 'customer'
  email_verified: boolean
}

interface AuthState {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))
