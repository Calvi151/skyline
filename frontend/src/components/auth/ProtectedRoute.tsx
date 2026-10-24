import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireVerified?: boolean
}

export function ProtectedRoute({
  children,
  requireVerified = false,
}: ProtectedRouteProps) {
  const { user, isLoading, isInitialized } = useAuthStore()
  const location = useLocation()

  // Wait for auth check before redirecting
  if (isLoading && !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page text-ink">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-subtle font-medium">Memeriksa otentikasi...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  }

  if (requireVerified && !user.email_verified) {
    return (
      <Navigate
        to={`/check-email?email=${encodeURIComponent(user.email)}`}
        replace
      />
    )
  }

  return <>{children}</>
}

interface RoleRouteProps {
  children: React.ReactNode
  allowedRoles: Array<'admin' | 'staff' | 'customer'>
}

export function RoleRoute({ children, allowedRoles }: RoleRouteProps) {
  const { user, isLoading, isInitialized } = useAuthStore()
  const location = useLocation()

  // Wait for auth check before redirecting
  if (isLoading && !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page text-ink">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-subtle font-medium">Memverifikasi hak akses...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect to their respective dashboard instead of an infinite loop
    if (user.role === 'admin') return <Navigate to="/admin" replace />
    if (user.role === 'staff') return <Navigate to="/staff" replace />
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute

