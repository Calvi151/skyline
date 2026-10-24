import DataTablePage, { ColumnDef, FormFieldDef, FilterTab } from '../../components/admin/DataTablePage'

export interface BaggageOptionItem {
  id: number
  name: string
  weight_kg?: number
  weightKg?: number
  price: number | string
  createdAt?: string
}

const mockBaggageOptions: BaggageOptionItem[] = [
  {
    id: 1,
    name: 'Bagasi Tambahan 5 kg',
    weight_kg: 5,
    price: 75000,
  },
  {
    id: 2,
    name: 'Bagasi Tambahan 10 kg',
    weight_kg: 10,
    price: 140000,
  },
  {
    id: 3,
    name: 'Bagasi Tambahan 15 kg',
    weight_kg: 15,
    price: 200000,
  },
  {
    id: 4,
    name: 'Bagasi Tambahan 20 kg (Standar)',
    weight_kg: 20,
    price: 260000,
  },
  {
    id: 5,
    name: 'Bagasi Tambahan 25 kg',
    weight_kg: 25,
    price: 320000,
  },
  {
    id: 6,
    name: 'Bagasi Ekstra 30 kg (Heavy)',
    weight_kg: 30,
    price: 380000,
  },
  {
    id: 7,
    name: 'Bagasi Ekstra 40 kg (Max Cargo)',
    weight_kg: 40,
    price: 500000,
  },
]

export default function BaggageOptionsPage() {
  const columns: ColumnDef<BaggageOptionItem>[] = [
    {
      key: 'name',
      label: 'NAMA OPSI BAGASI',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-tint text-brand-fg flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">luggage</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-ink">{item.name}</span>
            <span className="text-xs text-subtle">Kategori Add-on Check-in Baggage</span>
          </div>
        </div>
      ),
    },
    {
      key: 'weight_kg',
      label: 'BERAT (KG)',
      sortable: true,
      render: (item) => {
        const weight = item.weight_kg ?? item.weightKg ?? 0
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tint text-brand-fg font-semibold text-xs tabular-nums">
            <span className="material-symbols-outlined text-[14px]">scale</span>
            <span>{weight} kg</span>
          </span>
        )
      },
    },
    {
      key: 'price',
      label: 'TARIF TAMBAHAN',
      sortable: true,
      render: (item) => (
        <div className="flex flex-col">
          <span className="font-bold text-ink tabular-nums text-sm">
            Rp {Number(item.price).toLocaleString('id-ID')}
          </span>
          <span className="text-[11px] text-subtle">Termasuk PPN</span>
        </div>
      ),
    },
  ]

  const fields: FormFieldDef[] = [
    {
      name: 'name',
      label: 'Nama Opsi Bagasi',
      type: 'text',
      placeholder: 'Contoh: Bagasi Tambahan 20 kg',
      required: true,
    },
    {
      name: 'weight_kg',
      label: 'Berat (Kilogram)',
      type: 'number',
      placeholder: '20',
      required: true,
    },
    {
      name: 'price',
      label: 'Tarif Tambahan (IDR)',
      type: 'number',
      placeholder: '250000',
      required: true,
    },
  ]

  const filterTabs: FilterTab[] = [
    { id: 'all', label: 'Semua Opsi' },
    { id: 'light', label: 'Ringan (≤ 15 kg)', filterFn: (item: BaggageOptionItem) => (item.weight_kg ?? item.weightKg ?? 0) <= 15 },
    { id: 'standard', label: 'Standar (20 kg)', filterFn: (item: BaggageOptionItem) => (item.weight_kg ?? item.weightKg ?? 0) === 20 },
    { id: 'heavy', label: 'Berat (> 20 kg)', filterFn: (item: BaggageOptionItem) => (item.weight_kg ?? item.weightKg ?? 0) > 20 },
  ]

  return (
    <DataTablePage<BaggageOptionItem>
      title="Master Data Opsi Bagasi"
      subtitle="Kelola opsi tambahan bagasi tercatat (check-in baggage) dan tarif prabayar penumpang."
      categoryTag="Pusat Kendali Armada • Baggage Policy"
      apiEndpoint="/admin/baggage-options"
      fallbackMockData={mockBaggageOptions}
      columns={columns}
      fields={fields}
      filterTabs={filterTabs}
      searchPlaceholder="Cari opsi bagasi atau berat..."
      addButtonText="Tambah Opsi Bagasi"
      getItemIdentifier={(item: BaggageOptionItem) => `${item.weight_kg ?? item.weightKg ?? ''}KG`}
      getItemName={(item: BaggageOptionItem) => item.name}
      deleteWarningMessage={(item: BaggageOptionItem) =>
        `Hapus ${item.name} (${item.weight_kg ?? item.weightKg ?? ''} kg)? Penumpang yang belum menyelesaikan pembayaran untuk opsi ini dapat terpengaruh.`
      }
    />
  )
}
