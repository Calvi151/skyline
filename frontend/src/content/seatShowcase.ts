export interface SeatItem {
  id: string
  row: number
  col: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  status: 'available' | 'occupied' | 'selected'
  type: 'window' | 'aisle' | 'middle'
  extraPrice: number
  description: string
  isEmergencyExit?: boolean
}

export const showcaseSeats: SeatItem[] = [
  // Row 14 (Extra Legroom row)
  { id: '14A', row: 14, col: 'A', status: 'selected', type: 'window', extraPrice: 45000, description: 'Jendela, ekstra legroom', isEmergencyExit: true },
  { id: '14B', row: 14, col: 'B', status: 'selected', type: 'middle', extraPrice: 45000, description: 'Tengah, ekstra legroom', isEmergencyExit: true },
  { id: '14C', row: 14, col: 'C', status: 'available', type: 'aisle', extraPrice: 45000, description: 'Lorong, ekstra legroom', isEmergencyExit: true },
  { id: '14D', row: 14, col: 'D', status: 'occupied', type: 'aisle', extraPrice: 45000, description: 'Terisi', isEmergencyExit: true },
  { id: '14E', row: 14, col: 'E', status: 'occupied', type: 'middle', extraPrice: 45000, description: 'Terisi', isEmergencyExit: true },
  { id: '14F', row: 14, col: 'F', status: 'available', type: 'window', extraPrice: 45000, description: 'Jendela, ekstra legroom', isEmergencyExit: true },

  // Row 15
  { id: '15A', row: 15, col: 'A', status: 'occupied', type: 'window', extraPrice: 0, description: 'Terisi' },
  { id: '15B', row: 15, col: 'B', status: 'available', type: 'middle', extraPrice: 0, description: 'Tengah, gratis' },
  { id: '15C', row: 15, col: 'C', status: 'available', type: 'aisle', extraPrice: 0, description: 'Lorong, gratis' },
  { id: '15D', row: 15, col: 'D', status: 'available', type: 'aisle', extraPrice: 0, description: 'Lorong, gratis' },
  { id: '15E', row: 15, col: 'E', status: 'available', type: 'middle', extraPrice: 0, description: 'Tengah, gratis' },
  { id: '15F', row: 15, col: 'F', status: 'occupied', type: 'window', extraPrice: 0, description: 'Terisi' },

  // Row 16
  { id: '16A', row: 16, col: 'A', status: 'available', type: 'window', extraPrice: 0, description: 'Jendela, gratis' },
  { id: '16B', row: 16, col: 'B', status: 'available', type: 'middle', extraPrice: 0, description: 'Tengah, gratis' },
  { id: '16C', row: 16, col: 'C', status: 'available', type: 'aisle', extraPrice: 0, description: 'Lorong, gratis' },
  { id: '16D', row: 16, col: 'D', status: 'occupied', type: 'aisle', extraPrice: 0, description: 'Terisi' },
  { id: '16E', row: 16, col: 'E', status: 'available', type: 'middle', extraPrice: 0, description: 'Tengah, gratis' },
  { id: '16F', row: 16, col: 'F', status: 'available', type: 'window', extraPrice: 0, description: 'Jendela, gratis' },
]
