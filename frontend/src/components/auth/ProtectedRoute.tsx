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
  const { user } = useAuthStore()
  const location = useLocation()

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
  const { user } = useAuthStore()
  const location = useLocation()

  if (!user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
