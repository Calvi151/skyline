import { ReactNode } from 'react'
import { RoleRoute as BaseRoleRoute } from '../components/auth/ProtectedRoute'

type Role = 'admin' | 'staff' | 'customer'

export default function RoleRoute({ role, children }: { role: Role; children: ReactNode }) {
  return <BaseRoleRoute allowedRoles={[role]}>{children}</BaseRoleRoute>
}

export { BaseRoleRoute as RoleRoute }

