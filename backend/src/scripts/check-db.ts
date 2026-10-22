import 'dotenv/config'
import { db } from '../db/index.js'
import { users, flightSchedules, airlines, airports, airplanes, baggageOptions } from '../db/schema.js'

async function check() {
  const allUsers = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, password: users.password }).from(users)
  console.log('USERS:', JSON.stringify(allUsers.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, hasPassword: !!u.password })), null, 2))

  // Ensure admin has a known password e.g. Admin123!
  const bcrypt = await import('bcryptjs')
  const { eq } = await import('drizzle-orm')
  for (const u of allUsers) {
    if (u.role === 'admin') {
      const isMatch = u.password ? await bcrypt.default.compare('Admin123!', u.password) : false
      console.log(`Admin ${u.email} matches Admin123!: ${isMatch}`)
      if (!isMatch) {
        const hash = await bcrypt.default.hash('Admin123!', 10)
        await db.update(users).set({ password: hash, emailVerifiedAt: new Date(), isActive: true }).where(eq(users.id, u.id))
        console.log(`Updated admin ${u.email} password to Admin123!`)
      }
    }
  }

  process.exit(0)
}

check().catch(e => {
  console.error(e)
  process.exit(1)
})
