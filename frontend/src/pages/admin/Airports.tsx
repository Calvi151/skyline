import DataTablePage, { ColumnDef, FormFieldDef, FilterTab } from '../../components/admin/DataTablePage'

export interface AirportItem {
  id: number
  code: string
  name: string
  city: string
  country: string
  timezone?: string | null
}

export default function AirportsPage() {
  const columns: ColumnDef<AirportItem>[] = [
    {
      key: 'code',
      label: 'Kode (IATA)',
      sortable: true,
      width: '130px',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-brand-fg bg-tint px-2.5 py-0.5 rounded tabular-nums font-mono">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Nama Bandara',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-ink text-xs">{row.name}</div>
          <div className="text-[11px] text-subtle mt-0.5">Terminal Komersial Penumpang</div>
        </div>
      ),
    },
    {
      key: 'city',
      label: 'Kota / Wilayah',
      sortable: true,
      render: (row) => <span className="text-subtle text-xs font-medium">{row.city}</span>,
    },
    {
      key: 'country',
      label: 'Negara',
      sortable: true,
      render: (row) => <span className="text-subtle text-xs">{row.country}</span>,
    },
    {
      key: 'timezone',
      label: 'Zona Waktu',
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tint/60 text-ink text-[11px] font-medium border border-line/60">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-fg" />
          <span>{row.timezone || 'Asia/Jakarta'}</span>
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
    {
      name: 'timezone',
      label: 'Zona Waktu (Opsional)',
      required: false,
      defaultValue: 'Asia/Jakarta',
      placeholder: 'Asia/Jakarta',
      helperText: 'Zona waktu IANA standar (misal: Asia/Jakarta, Asia/Makassar, Asia/Jayapura).',
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
      fallbackMockData={[]}
    />
  )
}
