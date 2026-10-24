import React, { useState, useEffect, useMemo } from 'react'
import AdminLayout from '../layout/AdminLayout'
import { api } from '../../lib/api'

export interface ColumnDef<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  width?: string
  align?: 'left' | 'right' | 'center'
  render?: (row: T, searchKeyword: string) => React.ReactNode
}

export interface FormFieldDef {
  name: string
  label: string
  type?: 'text' | 'number' | 'select'
  required?: boolean
  uppercase?: boolean
  maxLength?: number
  placeholder?: string
  helperText?: string
  options?: Array<{ value: string | number; label: string }>
  validate?: (value: any) => string | null
  defaultValue?: any
  gridSpan?: 1 | 2
}

export interface FilterTab {
  id: string
  label: string
  filterFn?: (item: any) => boolean
}

export interface DataTablePageProps<T> {
  title: string
  subtitle: string
  categoryTag?: string
  syncTag?: string
  addButtonText: string
  apiEndpoint: string
  searchPlaceholder?: string
  filterTabs?: FilterTab[]
  columns: ColumnDef<T>[]
  fields: FormFieldDef[]
  getItemIdentifier?: (item: T) => string
  getItemName?: (item: T) => string
  deleteWarningMessage?: (item: T) => string
  exportFilename?: string
  customHeaderExtra?: React.ReactNode
  fallbackMockData?: T[]
}

export default function DataTablePage<T extends { id: number | string }>({
  title,
  subtitle,
  categoryTag = 'Master Operasional Hub',
  syncTag = 'SINKRONISASI IATA AKTIF',
  addButtonText,
  apiEndpoint,
  searchPlaceholder = 'Cari data...',
  filterTabs,
  columns,
  fields,
  getItemIdentifier = (item: any) => item.code || item.registrationNumber || `#${item.id}`,
  getItemName = (item: any) => item.name || item.model || 'Item',
  deleteWarningMessage,
  exportFilename = 'master-data.csv',
  fallbackMockData = [],
}: DataTablePageProps<T>) {
  // ─── Data State ───
  const [data, setData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // ─── Search, Filter, Sort & Selection State ───
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState(filterTabs ? filterTabs[0].id : 'all')
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([])
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  // ─── Modal Form State (Create / Edit) ───
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<T | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ─── Delete Dialog State ───
  const [deleteItem, setDeleteItem] = useState<T | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ─── Toast Notification State ───
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => {
      setToastMessage(null)
    }, 3500)
  }

  // ─── Fetch Data ───
  const fetchData = async () => {
    setIsLoading(true)
    try {
      const res = await api.get(apiEndpoint)
      const list = res.data?.data !== undefined ? res.data.data : res.data
      if (Array.isArray(list)) {
        setData(list)
      } else {
        setData(fallbackMockData)
      }
    } catch (err: any) {
      console.warn(`Error fetching ${apiEndpoint}, using fallback mock data:`, err)
      setData(fallbackMockData)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [apiEndpoint])

  // ─── Filter & Search Logic ───
  const filteredData = useMemo(() => {
    let list = [...data]

    // Tab Filter
    if (filterTabs && activeTab !== 'all') {
      const tabDef = filterTabs.find((t) => t.id === activeTab)
      if (tabDef?.filterFn) {
        list = list.filter(tabDef.filterFn)
      }
    }

    // Keyword Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((item: any) => {
        return Object.values(item).some((val) => {
          if (val === null || val === undefined) return false
          if (typeof val === 'object') {
            return Object.values(val).some((nested) =>
              String(nested).toLowerCase().includes(q)
            )
          }
          return String(val).toLowerCase().includes(q)
        })
      })
    }

    // Sorting
    if (sortField) {
      list.sort((a: any, b: any) => {
        let valA = a[sortField]
        let valB = b[sortField]
        if (typeof valA === 'string') valA = valA.toLowerCase()
        if (typeof valB === 'string') valB = valB.toLowerCase()

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return list
  }, [data, searchQuery, activeTab, filterTabs, sortField, sortDirection])

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, currentPage, pageSize])

  // Reset page when search or tab changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, activeTab])

  // ─── Sort Trigger ───
  const handleSort = (key: string) => {
    if (sortField === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(key)
      setSortDirection('asc')
    }
  }

  // ─── Selection Logic ───
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedData.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(paginatedData.map((d) => d.id))
    }
  }

  const toggleSelectRow = (id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  // ─── Export CSV ───
  const handleExportCSV = () => {
    if (filteredData.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'error')
      return
    }

    const headers = columns.map((c) => `"${c.label}"`).join(',')
    const rows = filteredData.map((row: any) =>
      columns
        .map((c) => {
          const val = row[c.key as string] ?? ''
          return typeof val === 'object' ? `"${JSON.stringify(val).replace(/"/g, '""')}"` : `"${String(val).replace(/"/g, '""')}"`
        })
        .join(',')
    )

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', exportFilename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast(`Data berhasil diekspor (${filteredData.length} baris)`)
  }

  // ─── Form Open / Close ───
  const openCreateModal = () => {
    setEditingItem(null)
    const initData: Record<string, any> = {}
    fields.forEach((f) => {
      initData[f.name] = f.defaultValue !== undefined ? f.defaultValue : ''
    })
    setFormData(initData)
    setFormErrors({})
    setIsModalOpen(true)
  }

  const openEditModal = (item: T) => {
    setEditingItem(item)
    const itemData: Record<string, any> = { ...item }

    // Auto map between camelCase and snake_case for defined fields
    fields.forEach((f) => {
      if (itemData[f.name] === undefined || itemData[f.name] === null) {
        // Convert snake_case field.name to camelCase (e.g. airline_id -> airlineId)
        const camelKey = f.name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
        if (itemData[camelKey] !== undefined && itemData[camelKey] !== null) {
          itemData[f.name] = itemData[camelKey]
        }
      }
    })

    setFormData(itemData)
    setFormErrors({})
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingItem(null)
    setFormData({})
    setFormErrors({})
  }

  // ─── Form Input Change & Live Validation ───
  const handleFieldChange = (name: string, value: any, fieldDef: FormFieldDef) => {
    let formattedVal = value
    if (fieldDef.uppercase && typeof value === 'string') {
      formattedVal = value.toUpperCase()
    }
    if (fieldDef.maxLength && typeof formattedVal === 'string') {
      formattedVal = formattedVal.slice(0, fieldDef.maxLength)
    }

    setFormData((prev) => ({ ...prev, [name]: formattedVal }))

    // Validate live
    if (fieldDef.validate) {
      const err = fieldDef.validate(formattedVal)
      setFormErrors((prev) => ({ ...prev, [name]: err || '' }))
    } else if (fieldDef.required && !formattedVal) {
      setFormErrors((prev) => ({ ...prev, [name]: `${fieldDef.label} wajib diisi` }))
    } else {
      setFormErrors((prev) => {
        const copy = { ...prev }
        delete copy[name]
        return copy
      })
    }
  }

  // ─── Form Submit (Create / Update) ───
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate all fields
    const errors: Record<string, string> = {}
    fields.forEach((f) => {
      const val = formData[f.name]
      if (f.required && (val === undefined || val === null || val === '')) {
        errors[f.name] = `${f.label} wajib diisi`
      } else if (f.validate) {
        const err = f.validate(val)
        if (err) errors[f.name] = err
      }
    })

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setIsSubmitting(true)

    try {
      // Build clean payload from defined form fields
      const payload: Record<string, any> = {}
      fields.forEach((f) => {
        if (formData[f.name] !== undefined) {
          payload[f.name] = formData[f.name]
        }
      })

      if (editingItem) {
        // UPDATE
        await api.put(`${apiEndpoint}/${editingItem.id}`, payload)
        showToast(`${title} berhasil diperbarui`)
      } else {
        // CREATE
        await api.post(apiEndpoint, payload)
        showToast(`${title} baru berhasil disimpan`)
      }
      closeModal()
      fetchData()
    } catch (err: any) {
      const serverMsg =
        err.response?.data?.message || err.message || 'Gagal menyimpan perubahan'
      showToast(serverMsg, 'error')
      // If server returned specific duplicate error
      if (err.response?.data?.code?.includes('DUPLICATE')) {
        setFormErrors((prev) => ({ ...prev, code: serverMsg, registration_number: serverMsg }))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Delete Item ───
  const handleDelete = async () => {
    if (!deleteItem) return
    setIsDeleting(true)

    try {
      await api.delete(`${apiEndpoint}/${deleteItem.id}`)
      showToast(`${title} ${getItemIdentifier(deleteItem)} berhasil dihapus`)
      setDeleteItem(null)
      fetchData()
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Gagal menghapus data'
      showToast(msg, 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AdminLayout currentSection={title}>
      <div className="flex flex-col gap-6">
        {/* ─── TOP ACTION HORIZON: Header, Breadcrumb Tag & Actions ─── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">
                {categoryTag}
              </span>
              <span className="w-1 h-1 rounded-full bg-line" />
              <span className="text-[10px] font-bold tracking-wider text-brand-fg">
                {syncTag}
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-ink tracking-tight font-sans">
              {title}
            </h1>
            <p className="text-xs md:text-sm text-subtle leading-relaxed">{subtitle}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportCSV}
              className="h-11 px-4 rounded-control bg-panel hover:bg-tint border border-line text-ink transition-colors text-xs font-semibold flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">file_download</span>
              <span>Ekspor CSV</span>
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="h-11 px-5 rounded-control bg-brand hover:bg-brand-hover text-white transition-all text-xs font-semibold flex items-center gap-2 shadow-sm active:scale-[0.99]"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>{addButtonText}</span>
            </button>
          </div>
        </div>

        {/* ─── FILTER & PRECISION SEARCH STRIP ─── */}
        <div className="bg-panel border border-line p-2.5 rounded-ticket flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
          {/* Search Input */}
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle text-[18px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-10 pl-10 pr-9 bg-page text-ink placeholder:text-subtle text-xs rounded-control outline-none border border-transparent focus:border-brand-fg focus:bg-panel transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle hover:text-ink"
                >
                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                </button>
              )}
            </div>

            {searchQuery && (
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-page text-subtle text-xs font-sans">
                <span className="font-bold text-ink">{filteredData.length}</span> hasil ditemukan
                untuk <span className="text-brand-fg font-semibold">"{searchQuery}"</span>
              </div>
            )}
          </div>

          {/* Tab Filter & Quick Controls */}
          <div className="flex items-center gap-2.5 self-end md:self-auto w-full md:w-auto justify-between md:justify-end">
            {filterTabs && filterTabs.length > 0 && (
              <div className="flex items-center rounded-control bg-page p-1 border border-line/60">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1 rounded-control text-xs transition-all ${
                      activeTab === tab.id
                        ? 'bg-panel text-brand-fg font-bold shadow-xs'
                        : 'text-subtle hover:text-ink'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-subtle">
              <span className="material-symbols-outlined text-[16px] text-success">verified</span>
              <span className="font-medium hidden sm:inline">Aktif</span>
            </div>
          </div>
        </div>

        {/* ─── MAIN MASTER DATA TABLE PANEL ─── */}
        <div className="bg-panel border border-line rounded-ticket overflow-hidden shadow-sm flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans">
              <thead>
                <tr className="bg-page/70 text-subtle text-[10px] font-bold uppercase tracking-wider border-b border-line select-none">
                  <th className="py-3.5 pl-5 pr-2 w-10 text-center" scope="col">
                    <input
                      type="checkbox"
                      checked={
                        paginatedData.length > 0 &&
                        selectedIds.length === paginatedData.length
                      }
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded accent-brand cursor-pointer"
                    />
                  </th>
                  {columns.map((col) => (
                    <th
                      key={String(col.key)}
                      scope="col"
                      style={{ width: col.width }}
                      className={`py-3.5 px-4 ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      }`}
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() => handleSort(String(col.key))}
                          className="inline-flex items-center gap-1 group hover:text-ink transition-colors"
                        >
                          <span>{col.label}</span>
                          <span className="material-symbols-outlined text-[14px] text-subtle group-hover:text-brand-fg">
                            {sortField === col.key
                              ? sortDirection === 'asc'
                                ? 'arrow_upward'
                                : 'arrow_downward'
                              : 'unfold_more'}
                          </span>
                        </button>
                      ) : (
                        <span>{col.label}</span>
                      )}
                    </th>
                  ))}
                  <th className="py-3.5 pr-6 pl-4 w-32 text-right" scope="col">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line text-xs text-ink">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 pl-5 pr-2">
                        <div className="w-4 h-4 bg-line/60 rounded mx-auto" />
                      </td>
                      {columns.map((_, colIdx) => (
                        <td key={colIdx} className="py-4 px-4">
                          <div className="h-4 bg-line/60 rounded w-3/4" />
                        </td>
                      ))}
                      <td className="py-4 pr-6 pl-4 text-right">
                        <div className="h-4 bg-line/60 rounded w-16 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + 2}
                      className="py-12 text-center text-subtle"
                    >
                      <div className="w-12 h-12 rounded-full bg-tint text-brand-fg flex items-center justify-center mx-auto mb-3">
                        <span className="material-symbols-outlined text-[24px]">
                          folder_off
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-ink">
                        Tidak ada data {title.toLowerCase()}
                      </p>
                      <p className="text-xs text-subtle mt-1">
                        {searchQuery
                          ? `Tidak ditemukan hasil yang cocok dengan "${searchQuery}"`
                          : `Belum ada ${title.toLowerCase()} yang terdaftar. Tambahkan sekarang.`}
                      </p>
                      {searchQuery ? (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="mt-3 text-xs font-semibold text-brand-fg hover:underline"
                        >
                          Hapus filter pencarian
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={openCreateModal}
                          className="mt-3 px-4 py-2 bg-brand text-white rounded-control text-xs font-semibold"
                        >
                          {addButtonText}
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row) => {
                    const isSelected = selectedIds.includes(row.id)
                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors group hover:bg-tint/30 ${
                          isSelected ? 'bg-tint/40 font-medium' : ''
                        }`}
                      >
                        <td className="py-3.5 pl-5 pr-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(row.id)}
                            className="w-3.5 h-3.5 rounded accent-brand cursor-pointer"
                          />
                        </td>

                        {columns.map((col) => {
                          const val = (row as any)[col.key]
                          return (
                            <td
                              key={String(col.key)}
                              className={`py-3.5 px-4 ${
                                col.align === 'right'
                                  ? 'text-right'
                                  : col.align === 'center'
                                  ? 'text-center'
                                  : 'text-left'
                              }`}
                            >
                              {col.render ? (
                                col.render(row, searchQuery)
                              ) : (
                                <span className="tabular-nums">
                                  {val !== null && val !== undefined ? String(val) : '-'}
                                </span>
                              )}
                            </td>
                          )
                        })}

                        <td className="py-3.5 pr-6 pl-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(row)}
                              className="text-brand-fg hover:underline font-semibold text-xs"
                            >
                              Ubah
                            </button>
                            <span className="text-line text-xs">•</span>
                            <button
                              type="button"
                              onClick={() => setDeleteItem(row)}
                              className="text-error hover:underline font-semibold text-xs"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ─── PAGINATION FOOTER ─── */}
          <div className="bg-panel px-6 py-3.5 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-subtle">
            <div>
              Menampilkan{' '}
              <span className="font-bold text-ink">
                {filteredData.length === 0
                  ? 0
                  : (currentPage - 1) * pageSize + 1}
                -
                {Math.min(currentPage * pageSize, filteredData.length)}
              </span>{' '}
              dari <span className="font-bold text-ink">{filteredData.length}</span> {title.toLowerCase()}
              {selectedIds.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded bg-tint text-brand-fg font-semibold">
                  {selectedIds.length} baris terpilih
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 select-none">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="w-8 h-8 rounded-control border border-line flex items-center justify-center text-subtle hover:text-ink hover:bg-page transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-control text-xs font-semibold transition-all ${
                      currentPage === pageNum
                        ? 'bg-brand text-white shadow-xs'
                        : 'border border-line hover:bg-page text-subtle hover:text-ink'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="w-8 h-8 rounded-control border border-line flex items-center justify-center text-subtle hover:text-ink hover:bg-page transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── LIVE MODAL: Tambah / Ubah Data (Stitch B14 Specification) ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-panel border border-line w-full max-w-[500px] rounded-ticket shadow-2xl overflow-hidden flex flex-col animate-scaleIn">
            {/* Modal Header */}
            <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-line">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">
                  Perbarui Registri {title}
                </span>
                <h2 className="text-lg font-bold text-ink">
                  {editingItem ? `Ubah Data ${title}` : `Tambah ${title} Baru`}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="w-8 h-8 rounded-control flex items-center justify-center text-subtle hover:text-ink hover:bg-page transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm}>
              <div className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
                {fields.map((field) => {
                  const val = formData[field.name] ?? ''
                  const err = formErrors[field.name]

                  // Specific preview validation badge for IATA/code
                  const isValidCode =
                    field.name === 'code' &&
                    typeof val === 'string' &&
                    val.length === 3 &&
                    !err

                  return (
                    <div key={field.name} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-ink">
                          {field.label}{' '}
                          {field.required && <span className="text-error">*</span>}
                        </label>
                        {isValidCode && (
                          <span className="text-[10px] font-bold text-success flex items-center gap-1 animate-scaleIn">
                            <span className="material-symbols-outlined text-[14px]">
                              check_circle
                            </span>
                            <span>VALID IATA</span>
                          </span>
                        )}
                      </div>

                      {field.type === 'select' ? (
                        <select
                          value={val}
                          onChange={(e) =>
                            handleFieldChange(field.name, e.target.value, field)
                          }
                          className={`w-full h-11 px-3.5 bg-page border rounded-control text-xs text-ink outline-none focus:border-brand-fg focus:ring-1 focus:ring-brand-fg transition-all ${
                            err ? 'border-error' : 'border-line'
                          }`}
                        >
                          <option value="">Pilih {field.label}</option>
                          {field.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="relative">
                          <input
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={val}
                            maxLength={field.maxLength}
                            placeholder={field.placeholder}
                            onChange={(e) =>
                              handleFieldChange(field.name, e.target.value, field)
                            }
                            className={`w-full h-11 px-3.5 bg-page border rounded-control text-xs text-ink outline-none focus:border-brand-fg focus:ring-1 focus:ring-brand-fg transition-all ${
                              field.uppercase ? 'uppercase font-bold tracking-wider' : ''
                            } ${err ? 'border-error ring-1 ring-error/20' : 'border-line'}`}
                          />
                        </div>
                      )}

                      {err ? (
                        <span className="text-[11px] text-error flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">
                            error
                          </span>
                          <span>{err}</span>
                        </span>
                      ) : field.helperText ? (
                        <span className="text-[11px] text-subtle leading-normal">
                          {field.helperText}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              {/* Modal Footer */}
              <div className="bg-page/70 px-6 py-4 border-t border-line flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="h-10 px-4 rounded-control text-xs font-semibold text-subtle hover:text-ink hover:bg-page transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 px-5 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-2 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>{editingItem ? 'Simpan perubahan' : 'Tambah data'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION DIALOG ─── */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-panel border border-line w-full max-w-[420px] rounded-ticket shadow-2xl p-6 flex flex-col gap-4 animate-scaleIn">
            <div className="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">warning</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="text-base font-bold text-ink">
                Hapus {title} {getItemIdentifier(deleteItem)}?
              </h3>
              <p className="text-xs text-subtle leading-relaxed">
                {deleteWarningMessage
                  ? deleteWarningMessage(deleteItem)
                  : `Semua jadwal penerbangan dan alokasi yang terikat pada ${getItemName(
                      deleteItem
                    )} akan terpengaruh atau dibatalkan.`}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setDeleteItem(null)}
                disabled={isDeleting}
                className="h-10 px-4 rounded-control text-xs font-semibold text-subtle hover:text-ink transition-colors"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-10 px-4 rounded-control bg-error hover:bg-error/90 text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-2 disabled:opacity-60"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>Hapus Permanen</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TOAST NOTIFICATION ─── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-panel border border-line text-ink px-4 py-3 rounded-control shadow-xl animate-scaleIn">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              toastMessage.type === 'success'
                ? 'bg-success/15 text-success'
                : 'bg-error/15 text-error'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {toastMessage.type === 'success' ? 'check_circle' : 'error'}
            </span>
          </div>
          <span className="text-xs font-semibold">{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-subtle hover:text-ink ml-2"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}
    </AdminLayout>
  )
}
