import { create } from 'zustand'
import { api } from '../lib/api'

export interface AuthUser {
  id: number
  name: string
  email: string
  phone?: string | null
  role: 'admin' | 'staff' | 'customer'
  email_verified: boolean
  has_password?: boolean
  has_google?: boolean
  created_at?: string
  stats?: {
    total_bookings: number
    paid_bookings: number
  }
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isInitialized: boolean
  setUser: (user: AuthUser | null) => void
  checkAuth: () => Promise<AuthUser | null>
  logout: () => Promise<void>
}

// Retrieve cached user from localStorage on first render to prevent UI flickering
const cachedUserStr = typeof window !== 'undefined' ? localStorage.getItem('skybook_user') : null
let initialUser: AuthUser | null = null
try {
  if (cachedUserStr) {
    initialUser = JSON.parse(cachedUserStr)
  }
} catch {
  initialUser = null
}

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  isLoading: !initialUser,
  isInitialized: Boolean(initialUser),
  setUser: (user) => {
    if (user) {
      localStorage.setItem('skybook_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('skybook_user')
    }
    set({ user, isLoading: false, isInitialized: true })
  },
  checkAuth: async () => {
    try {
      const res = await api.get('/auth/me')
      const userData = res.data?.data || res.data?.user || res.data
      if (userData && userData.id) {
        localStorage.setItem('skybook_user', JSON.stringify(userData))
        set({ user: userData, isLoading: false, isInitialized: true })
        return userData
      } else {
        localStorage.removeItem('skybook_user')
        set({ user: null, isLoading: false, isInitialized: true })
        return null
      }
    } catch {
      // Not authenticated or network issue
      localStorage.removeItem('skybook_user')
      set({ user: null, isLoading: false, isInitialized: true })
      return null
    }
  },
  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('skybook_user')
      set({ user: null, isLoading: false, isInitialized: true })
    }
  },
}))

