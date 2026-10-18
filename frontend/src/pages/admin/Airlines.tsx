import React from 'react'
import DataTablePage, { ColumnDef, FormFieldDef } from '../../components/admin/DataTablePage'

export interface AirlineItem {
  id: number
  name: string
  code: string
  logo?: string | null
  fleetCount?: number
}

const mockAirlines: AirlineItem[] = [
  {
    id: 1,
    name: 'Garuda Indonesia',
    code: 'GA',
    logo: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=100&auto=format&fit=crop&q=80',
    fleetCount: 14,
  },
  {
    id: 2,
    name: 'Batik Air',
    code: 'ID',
    logo: null,
    fleetCount: 22,
  },
  {
    id: 3,
    name: 'Citilink',
    code: 'QG',
    logo: null,
    fleetCount: 18,
  },
  {
    id: 4,
    name: 'Lion Air',
    code: 'JT',
    logo: null,
    fleetCount: 30,
  },
  {
    id: 5,
    name: 'Wings Air',
    code: 'IW',
    logo: null,
    fleetCount: 12,
  },
  {
    id: 6,
    name: 'Super Air Jet',
    code: 'IU',
    logo: null,
    fleetCount: 10,
  },
]

export default function AirlinesPage() {
  const columns: ColumnDef<AirlineItem>[] = [
    {
      key: 'code',
      label: 'Kode Maskapai',
      sortable: true,
      width: '130px',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-brand-fg bg-tint px-2 py-0.5 rounded tabular-nums">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Nama Maskapai',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-control bg-page border border-line flex items-center justify-center font-bold text-xs text-brand-fg shrink-0 overflow-hidden">
            {row.logo ? (
              <img src={row.logo} alt={row.name} className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-[18px]">airlines</span>
            )}
          </div>
          <div>
            <div className="font-bold text-xs text-ink">{row.name}</div>
            <div className="text-[10px] text-subtle">Sertifikasi AOC Kemenhub RI</div>
          </div>
        </div>
      ),
    },
    {
      key: 'fleet',
      label: 'Armada Aktif',
      sortable: false,
      render: (row) => (
        <span className="text-xs text-subtle font-medium tabular-nums">
          {row.fleetCount || 8} Unit Pesawat
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status Lisensi',
      render: () => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tint/60 text-ink text-[11px] font-medium border border-line/60">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span>Beroperasi</span>
        </span>
      ),
    },
  ]

  const fields: FormFieldDef[] = [
    {
      name: 'code',
      label: 'Kode IATA Maskapai (2-3 Karakter)',
      required: true,
      uppercase: true,
      maxLength: 3,
      placeholder: 'Contoh: GA, ID, QG, JT',
      helperText: 'Kode 2 atau 3 huruf standar penerbangan IATA.',
      validate: (val) => {
        if (!val || val.length < 2 || val.length > 3) {
          return 'Kode maskapai harus 2 sampai 3 karakter'
        }
        return null
      },
    },
    {
      name: 'name',
      label: 'Nama Resmi Maskapai',
      required: true,
      placeholder: 'Contoh: Garuda Indonesia',
      validate: (val) => (!val || val.trim().length < 3 ? 'Nama maskapai minimal 3 karakter' : null),
    },
    {
      name: 'logo',
      label: 'URL Logo Maskapai (Opsional)',
      required: false,
      placeholder: 'https://...',
      helperText: 'Tautan gambar logo atau ikon resmi maskapai penerbangan.',
    },
  ]

  return (
    <DataTablePage<AirlineItem>
      title="Maskapai"
      subtitle="Kelola maskapai rekanan, kode penerbangan resmi, dan logo maskapai."
      categoryTag="Master Data Armada"
      syncTag="REGULASI DIRJEN PERHUBUNGAN UDARA"
      addButtonText="Tambah maskapai"
      apiEndpoint="/admin/airlines"
      searchPlaceholder="Cari nama atau kode maskapai..."
      columns={columns}
      fields={fields}
      getItemIdentifier={(item) => item.code}
      getItemName={(item) => item.name}
      deleteWarningMessage={(item) =>
        `Hapus maskapai ${item.name} (${item.code})? Semua jadwal penerbangan dan pesawat yang terafiliasi dengan maskapai ini akan terdampak.`
      }
      exportFilename="master-data-maskapai.csv"
      fallbackMockData={mockAirlines}
    />
  )
}
