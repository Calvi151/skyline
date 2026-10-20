import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { providerUsage } from '../db/schema.js'

export class QuotaGuardService {
  private getPeriod(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  private getMonthlyLimit(): number {
    return Number(process.env.PROVIDER_MONTHLY_LIMIT || 500)
  }

  /**
   * Cek apakah pemakaian kuota masih dalam batas aman (< 90% dari batas bulanan).
   */
  async checkQuota(
    provider: string,
    unitsToConsume = 1,
  ): Promise<{
    allowed: boolean
    unitsUsed: number
    monthlyLimit: number
    percent: number
  }> {
    const period = this.getPeriod()
    const monthlyLimit = this.getMonthlyLimit()

    const [usage] = await db
      .select()
      .from(providerUsage)
      .where(and(eq(providerUsage.provider, provider), eq(providerUsage.period, period)))
      .limit(1)

    const unitsUsed = usage?.unitsUsed ?? 0
    const percent = Math.round((unitsUsed / monthlyLimit) * 100)

    // DAT-07: Panggilan dihentikan saat pemakaian bulan berjalan mencapai 90%
    const allowed = unitsUsed + unitsToConsume <= Math.floor(monthlyLimit * 0.9)

    return {
      allowed,
      unitsUsed,
      monthlyLimit,
      percent,
    }
  }

  /**
   * Mencatat pemakaian kuota API provider
   */
  async recordUsage(provider: string, units = 1): Promise<void> {
    const period = this.getPeriod()

    await db
      .insert(providerUsage)
      .values({
        provider,
        period,
        unitsUsed: units,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [providerUsage.provider, providerUsage.period],
        set: {
          unitsUsed: sql`${providerUsage.unitsUsed} + ${units}`,
          updatedAt: new Date(),
        },
      })
  }

  /**
   * Mengambil data statistik pemakaian kuota untuk admin
   */
  async getUsage(provider: string): Promise<{
    provider: string
    period: string
    units_used: number
    monthly_limit: number
    percent: number
  }> {
    const period = this.getPeriod()
    const monthlyLimit = this.getMonthlyLimit()

    const [usage] = await db
      .select()
      .from(providerUsage)
      .where(and(eq(providerUsage.provider, provider), eq(providerUsage.period, period)))
      .limit(1)

    const unitsUsed = usage?.unitsUsed ?? 0
    const percent = Number(((unitsUsed / monthlyLimit) * 100).toFixed(1))

    return {
      provider,
      period,
      units_used: unitsUsed,
      monthly_limit: monthlyLimit,
      percent,
    }
  }
}

export const quotaGuardService = new QuotaGuardService()
