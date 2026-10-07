import { db } from '../db/index.js'
import { emailVerificationTokens, users } from '../db/schema.js'
import { eq, and, gt, desc, count, sql } from 'drizzle-orm'
import { generateVerificationToken, hashToken } from '../utils/generateCode.js'

export class VerificationService {
  /**
   * Buat token verifikasi baru dan simpan hash-nya di DB.
   * Berlaku 24 jam.
   */
  async createToken(userId: number): Promise<string> {
    const rawToken = generateVerificationToken()
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 jam

    await db.insert(emailVerificationTokens).values({
      userId,
      tokenHash,
      expiresAt,
    })

    return rawToken
  }

  /**
   * Periksa rate limit kirim ulang:
   * - Cooldown 60 detik dari token terakhir
   * - Maksimal 5 permintaan dalam 1 jam terakhir
   */
  async checkRateLimit(userId: number): Promise<{ allowed: boolean; code?: string; retryAfter?: number }> {
    // Cek token terakhir yang dibuat dan hitung selisih detik di level database
    const [latestToken] = await db
      .select({
        elapsedSeconds: sql<number>`EXTRACT(EPOCH FROM (NOW() - ${emailVerificationTokens.createdAt}))`,
      })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId))
      .orderBy(desc(emailVerificationTokens.createdAt))
      .limit(1)

    if (latestToken && latestToken.elapsedSeconds !== null && latestToken.elapsedSeconds !== undefined) {
      const elapsed = Math.floor(Number(latestToken.elapsedSeconds))
      if (elapsed < 60) {
        return {
          allowed: false,
          code: 'RESEND_TOO_SOON',
          retryAfter: Math.max(1, 60 - elapsed),
        }
      }
    }

    // Cek jumlah token dalam 1 jam terakhir
    const [hourlyCount] = await db
      .select({ total: count() })
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.userId, userId),
          sql`${emailVerificationTokens.createdAt} > NOW() - INTERVAL '1 hour'`,
        ),
      )

    if (hourlyCount && Number(hourlyCount.total) >= 5) {
      return {
        allowed: false,
        code: 'RESEND_LIMIT_REACHED',
      }
    }

    return { allowed: true }
  }

  /**
   * Verifikasi token hash dan aktifkan status email user.
   */
  async verifyToken(rawToken: string): Promise<{ success: boolean; code?: string; userId?: number }> {
    const tokenHash = hashToken(rawToken)

    const [tokenRecord] = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash))
      .limit(1)

    if (!tokenRecord || tokenRecord.usedAt !== null) {
      return { success: false, code: 'TOKEN_INVALID' }
    }

    if (new Date() > tokenRecord.expiresAt) {
      return { success: false, code: 'TOKEN_EXPIRED' }
    }

    const now = new Date()

    // Tandai token sudah digunakan
    await db
      .update(emailVerificationTokens)
      .set({ usedAt: now })
      .where(eq(emailVerificationTokens.id, tokenRecord.id))

    // Update status email_verified_at pada user
    await db
      .update(users)
      .set({ emailVerifiedAt: now })
      .where(eq(users.id, tokenRecord.userId))

    return { success: true, userId: tokenRecord.userId }
  }
}

export const verificationService = new VerificationService()
