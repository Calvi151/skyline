export interface JwtPayload {
  userId: number
  role: 'admin' | 'staff' | 'customer'
}

export interface UserContext {
  id: number
  name: string
  email: string
  role: 'admin' | 'staff' | 'customer'
  emailVerifiedAt: Date | null
  isActive: boolean | null
}

export interface ApiResponse<T = any> {
  error: boolean
  data?: T
  message?: string
  code?: string
}
