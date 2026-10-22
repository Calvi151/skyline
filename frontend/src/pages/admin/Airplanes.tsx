import { useState, useEffect } from 'react'
import DataTablePage, { ColumnDef, FormFieldDef, FilterTab } from '../../components/admin/DataTablePage'
import { api } from '../../lib/api'

export interface AirplaneItem {
  id: number
  airlineId: number
  registrationNumber: string
  model: string
  totalSeatEconomy: number
  totalSeatBusiness: number
  airline?: {
    id: number
    name: string
    code: string
    logo?: string | null
  }
}

const mockAirplanes: AirplaneItem[] = [
  {
    id: 1,
    airlineId: 1,
    registrationNumber: 'PK-GNA',
    model: 'Boeing 737-800 Next-Gen',
    totalSeatEconomy: 150,
    totalSeatBusiness: 12,
    airline: { id: 1, name: 'Garuda Indonesia', code: 'GA' },
  },
  {
    id: 2,
    airlineId: 2,
    registrationNumber: 'PK-BDF',
    model: 'Airbus A320-200 NEO',
    totalSeatEconomy: 144,
    totalSeatBusiness: 12,
    airline: { id: 2, name: 'Batik Air', code: 'ID' },
  },
  {
    id: 3,
    airlineId: 3,
    registrationNumber: 'PK-GLC',
    model: 'Airbus A320-200',
    totalSeatEconomy: 180,
    totalSeatBusiness: 0,
    airline: { id: 3, name: 'Citilink', code: 'QG' },
  },
  {
    id: 4,
    airlineId: 4,
    registrationNumber: 'PK-LQF',
    model: 'Boeing 737-900ER',
    totalSeatEconomy: 215,
    totalSeatBusiness: 0,
    airline: { id: 4, name: 'Lion Air', code: 'JT' },
  },
  {
    id: 5,
    airlineId: 5,
    registrationNumber: 'PK-WIF',
    model: 'ATR 72-600 Turboprop',
    totalSeatEconomy: 72,
    totalSeatBusiness: 0,
    airline: { id: 5, name: 'Wings Air', code: 'IW' },
  },
]

export default function AirplanesPage() {
  const [airlineOptions, setAirlineOptions] = useState<Array<{ value: number; label: string }>>([
    { value: 1, label: 'Garuda Indonesia (GA)' },
    { value: 2, label: 'Batik Air (ID)' },
    { value: 3, label: 'Citilink (QG)' },
    { value: 4, label: 'Lion Air (JT)' },
    { value: 5, label: 'Wings Air (IW)' },
  ])

  useEffect(() => {
    api
      .get('/admin/airlines')
      .then((res) => {
        const list = res.data?.data || res.data
        if (Array.isArray(list) && list.length > 0) {
          setAirlineOptions(
            list.map((a: any) => ({
              value: a.id,
              label: `${a.name} (${a.code})`,
            }))
          )
        }
      })
      .catch(() => {})
  }, [])

  const columns: ColumnDef<AirplaneItem>[] = [
    {
      key: 'registrationNumber',
      label: 'Registrasi Pesawat',
      sortable: true,
      width: '160px',
      render: (row) => (
        <div className="flex items-center gap-1.5 font-bold text-ink">
          <span className="material-symbols-outlined text-[16px] text-brand-fg">flight</span>
          <span className="font-mono text-xs uppercase tracking-wider">{row.registrationNumber}</span>
        </div>
      ),
    },
    {
      key: 'model',
      label: 'Model / Tipe Pesawat',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-xs text-ink">{row.model}</div>
          <div className="text-[10px] text-subtle">
            {row.airline ? row.airline.name : 'Maskapai Rekanan'}
          </div>
        </div>
      ),
    },
    {
      key: 'capacity',
      label: 'Konfigurasi Kursi',
      sortable: false,
      render: (row) => {
        const total = (row.totalSeatEconomy || 0) + (row.totalSeatBusiness || 0)
        return (
          <div className="flex items-center gap-2 text-xs tabular-nums">
            <span className="font-bold text-ink">{total} Kursi</span>
            <span className="text-[11px] text-subtle">
              ({row.totalSeatEconomy} Ekonomi {row.totalSeatBusiness > 0 && `• ${row.totalSeatBusiness} Bisnis`})
            </span>
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Kelayakan Terbang',
      render: () => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tint/60 text-ink text-[11px] font-medium border border-line/60">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span>Airworthy (Layak)</span>
        </span>
      ),
    },
  ]

  const fields: FormFieldDef[] = [
    {
      name: 'airline_id',
      label: 'Maskapai Pemilik',
      type: 'select',
      required: true,
      options: airlineOptions,
      helperText: 'Pilih maskapai yang mengoperasikan unit armada ini.',
      validate: (val) => (!val ? 'Silakan pilih maskapai' : null),
    },
    {
      name: 'registration_number',
      label: 'Nomor Registrasi PK (Ekor Pesawat)',
      required: true,
      uppercase: true,
      placeholder: 'Contoh: PK-GNA, PK-LQF',
      helperText: 'Format registrasi pesawat terbang sipil Indonesia (Awalan PK-).',
      validate: (val) => {
        if (!val || val.length < 3) return 'Nomor registrasi wajib diisi'
        return null
      },
    },
    {
      name: 'model',
      label: 'Tipe & Seri Pesawat',
      required: true,
      placeholder: 'Contoh: Boeing 737-800 Next-Gen',
      validate: (val) => (!val ? 'Tipe pesawat wajib diisi' : null),
    },
    {
      name: 'total_seat_economy',
      label: 'Kapasitas Kursi Kelas Ekonomi',
      type: 'number',
      required: true,
      defaultValue: 150,
      placeholder: '150',
      validate: (val) => (Number(val) < 1 ? 'Minimal 1 kursi ekonomi' : null),
    },
    {
      name: 'total_seat_business',
      label: 'Kapasitas Kursi Kelas Bisnis (Opsional)',
      type: 'number',
      required: false,
      defaultValue: 0,
      placeholder: '0',
    },
  ]

  const filterTabs: FilterTab[] = [
    { id: 'all', label: 'Semua Armada' },
    {
      id: 'boeing',
      label: 'Boeing',
      filterFn: (item) => item.model?.toLowerCase().includes('boeing'),
    },
    {
      id: 'airbus',
      label: 'Airbus',
      filterFn: (item) => item.model?.toLowerCase().includes('airbus'),
    },
    {
      id: 'atr',
      label: 'ATR / Propeller',
      filterFn: (item) => item.model?.toLowerCase().includes('atr'),
    },
  ]

  return (
    <DataTablePage<AirplaneItem>
      title="Armada Pesawat"
      subtitle="Registri nomor badan pesawat, tipe manufaktur, dan kapasitas kabin."
      categoryTag="Master Data Armada"
      syncTag="STANDAR AIRWORTHINESS DGCA"
      addButtonText="Tambah pesawat"
      apiEndpoint="/admin/airplanes"
      searchPlaceholder="Cari nomor registrasi atau model pesawat..."
      filterTabs={filterTabs}
      columns={columns}
      fields={fields}
      getItemIdentifier={(item) => item.registrationNumber}
      getItemName={(item) => `${item.model} (${item.registrationNumber})`}
      deleteWarningMessage={(item) =>
        `Hapus pesawat ${item.registrationNumber}? Jadwal penerbangan yang dijadwalkan menggunakan pesawat ini tidak dapat dioperasikan.`
      }
      exportFilename="master-data-pesawat.csv"
      fallbackMockData={mockAirplanes}
    />
  )
}
