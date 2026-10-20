export interface GenerateSeatsParams {
  flightScheduleId: number
  airplaneId: number
  totalSeatEconomy: number
  totalSeatBusiness: number
}

export interface GeneratedSeat {
  flightScheduleId: number
  airplaneId: number
  seatNumber: string
  seatClass: 'economy' | 'business'
  isAvailable: boolean
}

/**
 * Otomatis menghasilkan daftar kursi berdasarkan kapasitas pesawat
 * - Business: 4 kursi per baris (A, C, D, F) mulai dari baris 1
 * - Economy: 6 kursi per baris (A, B, C, D, E, F)
 */
export function generateSeatList(params: GenerateSeatsParams): GeneratedSeat[] {
  const { flightScheduleId, airplaneId, totalSeatEconomy, totalSeatBusiness } = params
  const seatRecords: GeneratedSeat[] = []

  // 1. Kursi Kelas Bisnis (Layout 2-2: A, C, D, F)
  const businessCols = ['A', 'C', 'D', 'F']
  let currentRow = 1
  let businessSeatsRemaining = totalSeatBusiness

  while (businessSeatsRemaining > 0) {
    for (const col of businessCols) {
      if (businessSeatsRemaining <= 0) break
      seatRecords.push({
        flightScheduleId,
        airplaneId,
        seatNumber: `${currentRow}${col}`,
        seatClass: 'business',
        isAvailable: true,
      })
      businessSeatsRemaining--
    }
    currentRow++
  }

  // 2. Kursi Kelas Ekonomi (Layout 3-3: A, B, C, D, E, F)
  // Jika ada kelas bisnis, beri penomoran baris berikutnya
  if (totalSeatBusiness > 0 && currentRow <= 5) {
    currentRow = Math.max(currentRow, 5) // mulai ekonomi dari baris 5 ke atas jika ada bisnis
  }

  const economyCols = ['A', 'B', 'C', 'D', 'E', 'F']
  let economySeatsRemaining = totalSeatEconomy

  while (economySeatsRemaining > 0) {
    for (const col of economyCols) {
      if (economySeatsRemaining <= 0) break
      seatRecords.push({
        flightScheduleId,
        airplaneId,
        seatNumber: `${currentRow}${col}`,
        seatClass: 'economy',
        isAvailable: true,
      })
      economySeatsRemaining--
    }
    currentRow++
  }

  return seatRecords
}
