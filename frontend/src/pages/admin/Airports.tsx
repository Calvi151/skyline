import React from 'react'
import DataTablePage, { ColumnDef, FormFieldDef, FilterTab } from '../../components/admin/DataTablePage'

export interface AirportItem {
  id: number
  code: string
  name: string
  city: string
  country: string
  icao?: string
  description?: string
}

const mockAirports: AirportItem[] = [
  {
    id: 1,
    code: 'CGK',
    icao: 'WIII',
    name: 'Soekarno-Hatta International Airport',
    description: 'Hub Utama 1, 2, & 3',
    city: 'Tangerang, Banten (Jakarta)',
    country: 'Indonesia',
  },
  {
    id: 2,
    code: 'DPS',
    icao: 'WADD',
    name: 'I Gusti Ngurah Rai International',
    description: "Terminal Domestik & Int'l",
    city: 'Denpasar, Bali',
    country: 'Indonesia',
  },
  {
    id: 3,
    code: 'SUB',
    icao: 'WARR',
    name: 'Juanda International Airport',
    description: 'Terminal 1 & 2 Sidoarjo',
    city: 'Surabaya, Jawa Timur',
    country: 'Indonesia',
  },
  {
    id: 4,
    code: 'UPG',
    icao: 'WAAA',
    name: 'Sultan Hasanuddin International Airport',
    description: 'Gerbang Hub Indonesia Timur',
    city: 'Makassar, Sulawesi Selatan',
    country: 'Indonesia',
  },
  {
    id: 5,
    code: 'KNO',
    icao: 'WIMM',
    name: 'Kualanamu International Airport',
    description: 'Konektivitas Rail Express',
    city: 'Deli Serdang / Medan, Sumut',
    country: 'Indonesia',
  },
  {
    id: 6,
    code: 'JOG',
    icao: 'WAHI',
    name: 'Yogyakarta International Airport (YIA)',
    description: 'Terminal Baru Modern Kulon Progo',
    city: 'Kulon Progo, D.I. Yogyakarta',
    country: 'Indonesia',
  },
  {
    id: 7,
    code: 'BPN',
    icao: 'WALL',
    name: 'Sultan Aji Muhammad Sulaiman Sepinggan',
    description: 'Gerbang IKN Nusantara',
    city: 'Balikpapan, Kalimantan Timur',
    country: 'Indonesia',
  },
  {
    id: 8,
    code: 'LOP',
    icao: 'WADL',
    name: 'Lombok International Airport (ZAM)',
    description: 'Kawasan Mandalika Circuit Access',
    city: 'Lombok Tengah, NTB',
    country: 'Indonesia',
  },
]

export default function AirportsPage() {
  const columns: ColumnDef<AirportItem>[] = [
    {
      key: 'code',
      label: 'Kode (IATA)',
      sortable: true,
      width: '140px',
      render: (row, q) => (
        <div className="flex items-baseline gap-1.5">
          <span className="font-bold text-sm tracking-tight text-ink font-sans tabular-nums">
            {row.code}
          </span>
          <span className="text-[10px] text-subtle font-mono uppercase">
            {row.icao || 'W---'}
          </span>
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Nama Bandara',
      sortable: true,
      render: (row, q) => {
        const desc = row.description || 'Terminal Penumpang'
        return (
          <div>
            <div className="font-semibold text-ink text-xs">{row.name}</div>
            <div className="text-[11px] text-subtle mt-0.5">{desc}</div>
          </div>
        )
      },
    },
    {
      key: 'city',
      label: 'Kota / Wilayah',
      sortable: true,
      render: (row) => <span className="text-subtle text-xs">{row.city}</span>,
    },
    {
      key: 'country',
      label: 'Negara',
      sortable: true,
      render: (row) => <span className="text-subtle text-xs">{row.country}</span>,
    },
    {
      key: 'status',
      label: 'Status Operasional',
      render: () => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tint/60 text-ink text-[11px] font-medium border border-line/60">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span>Aktif</span>
        </span>
      ),
    },
  ]

  const fields: FormFieldDef[] = [
    {
      name: 'code',
      label: 'Kode IATA (3 Karakter)',
      required: true,
      uppercase: true,
      maxLength: 3,
      placeholder: 'Contoh: CGK, SUB, DPS',
      helperText: 'Kode 3 huruf terdaftar resmi di database IATA Internasional.',
      validate: (val) => {
        if (!val || val.length !== 3) {
          return 'Kode IATA harus terdiri dari tepat 3 huruf'
        }
        if (!/^[A-Z]{3}$/.test(val)) {
          return 'Kode hanya boleh berupa kombinasi huruf alfabet'
        }
        return null
      },
    },
    {
      name: 'name',
      label: 'Nama Resmi Bandara',
      required: true,
      placeholder: 'Contoh: Soekarno-Hatta International Airport',
      validate: (val) => (!val || val.trim().length < 3 ? 'Nama bandara minimal 3 karakter' : null),
    },
    {
      name: 'city',
      label: 'Kota / Wilayah Layanan',
      required: true,
      placeholder: 'Contoh: Jakarta / Tangerang',
      validate: (val) => (!val || val.trim().length < 2 ? 'Kota wajib diisi' : null),
    },
    {
      name: 'country',
      label: 'Negara',
      required: true,
      defaultValue: 'Indonesia',
      placeholder: 'Indonesia',
      validate: (val) => (!val ? 'Negara wajib diisi' : null),
    },
  ]

  const filterTabs: FilterTab[] = [
    { id: 'all', label: 'Semua' },
    {
      id: 'domestic',
      label: 'Domestik',
      filterFn: (item) => item.country?.toLowerCase() === 'indonesia',
    },
    {
      id: 'international',
      label: 'Internasional',
      filterFn: (item) => item.country?.toLowerCase() !== 'indonesia',
    },
  ]

  return (
    <DataTablePage<AirportItem>
      title="Bandara"
      subtitle="Kelola data master bandara, kode IATA, lokasi rute domestik dan internasional."
      categoryTag="Master Operasional Hub"
      syncTag="SINKRONISASI IATA AKTIF"
      addButtonText="Tambah bandara"
      apiEndpoint="/admin/airports"
      searchPlaceholder="Cari bandara atau kota..."
      filterTabs={filterTabs}
      columns={columns}
      fields={fields}
      getItemIdentifier={(item) => item.code}
      getItemName={(item) => item.name}
      deleteWarningMessage={(item) =>
        `Hapus bandara ${item.code}? Semua jadwal penerbangan, manifest rute, dan alokasi yang terikat pada bandara ${item.name} akan terpengaruh.`
      }
      exportFilename="master-data-bandara.csv"
      fallbackMockData={mockAirports}
    />
  )
}
