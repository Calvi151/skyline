import { eq, lt, gt } from 'drizzle-orm'
import { db } from '../db/index.js'
import { providerCache } from '../db/schema.js'

export class ProviderCacheService {
  /**
   * Mengambil data dari cache jika belum kedaluwarsa
   */
  async get<T>(cacheKey: string): Promise<T | null> {
    try {
      const now = new Date()
      const [entry] = await db
        .select()
        .from(providerCache)
        .where(eq(providerCache.cacheKey, cacheKey))
        .limit(1)

      if (!entry) return null

      if (entry.expiresAt && entry.expiresAt <= now) {
        // Hapus jika sudah kedaluwarsa
        await db.delete(providerCache).where(eq(providerCache.id, entry.id)).catch(() => {})
        return null
      }

      return entry.payload as T
    } catch (err) {
      console.error(`[ProviderCacheService] Gagal membaca cache untuk ${cacheKey}:`, err)
      return null
    }
  }

  /**
   * Menyimpan data ke dalam cache dengan batas waktu (TTL) dalam detik
   */
  async set<T>(cacheKey: string, payload: T, ttlSeconds: number): Promise<void> {
    try {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)

      await db
        .insert(providerCache)
        .values({
          cacheKey,
          payload: payload as any,
          fetchedAt: now,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: providerCache.cacheKey,
          set: {
            payload: payload as any,
            fetchedAt: now,
            expiresAt,
          },
        })
    } catch (err) {
      console.error(`[ProviderCacheService] Gagal menulis cache untuk ${cacheKey}:`, err)
    }
  }

  /**
   * Menghapus seluruh entri cache yang sudah kedaluwarsa
   */
  async cleanExpired(): Promise<number> {
    try {
      const now = new Date()
      const deleted = await db
        .delete(providerCache)
        .where(lt(providerCache.expiresAt, now))
        .returning({ id: providerCache.id })

      return deleted.length
    } catch (err) {
      console.error('[ProviderCacheService] Gagal membersihkan cache kedaluwarsa:', err)
      return 0
    }
  }
}

export const providerCacheService = new ProviderCacheService()
