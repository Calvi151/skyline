import React, { useState } from 'react'

export interface PaginationProps {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  itemLabel?: string
  className?: string
  showPageSizeSelector?: boolean
  showJumpToPage?: boolean
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = 'data',
  className = '',
  showPageSizeSelector = true,
  showJumpToPage = true,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const [jumpInput, setJumpInput] = useState('')

  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)

  // Smart page windows: e.g. [1, 2, 3, 4, 5, '...', 81] or [1, '...', 9, 10, 11, '...', 81]
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages]
    }

    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
  }

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault()
    const target = parseInt(jumpInput, 10)
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      onPageChange(target)
      setJumpInput('')
    }
  }

  const pages = getPageNumbers()

  return (
    <div
      className={`bg-panel px-4 sm:px-6 py-3.5 border-t border-line flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-subtle select-none ${className}`}
    >
      {/* Left: Summary Info & Rows per page */}
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-start">
        <div>
          Menampilkan{' '}
          <span className="font-bold text-ink tabular-nums">
            {start.toLocaleString('id-ID')} - {end.toLocaleString('id-ID')}
          </span>{' '}
          dari <span className="font-bold text-ink tabular-nums">{totalItems.toLocaleString('id-ID')}</span>{' '}
          {itemLabel}
          <span className="hidden sm:inline text-subtle/80 ml-1.5 font-normal">
            (Hal. {currentPage} dari {totalPages})
          </span>
        </div>

        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
            <span className="text-subtle text-[11px]">Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 px-2 rounded-control bg-raised border border-line text-ink text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / hal
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page Buttons & Quick Jump */}
      <div className="flex flex-wrap items-center gap-2 justify-center md:justify-end w-full md:w-auto">
        {/* First Page */}
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          title="Halaman pertama"
          className="w-8 h-8 rounded-control border border-line bg-raised hover:bg-page text-subtle hover:text-ink flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[16px]">first_page</span>
        </button>

        {/* Prev Page */}
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Halaman sebelumnya"
          className="w-8 h-8 rounded-control border border-line bg-raised hover:bg-page text-subtle hover:text-ink flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
        </button>

        {/* Page Number Chips */}
        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots-${idx}`} className="w-7 text-center text-subtle font-bold">
                  …
                </span>
              )
            }

            const pageNum = p as number
            const isActive = pageNum === currentPage

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`min-w-8 h-8 px-2 rounded-control text-xs font-semibold transition-all tabular-nums ${
                  isActive
                    ? 'bg-brand text-white shadow-xs font-bold'
                    : 'border border-line bg-raised hover:bg-page text-subtle hover:text-ink'
                }`}
              >
                {pageNum}
              </button>
            )
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          title="Halaman berikutnya"
          className="w-8 h-8 rounded-control border border-line bg-raised hover:bg-page text-subtle hover:text-ink flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>

        {/* Last Page */}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          title="Halaman terakhir"
          className="w-8 h-8 rounded-control border border-line bg-raised hover:bg-page text-subtle hover:text-ink flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[16px]">last_page</span>
        </button>

        {/* Quick Jump Input */}
        {showJumpToPage && totalPages > 5 && (
          <form onSubmit={handleJump} className="hidden sm:flex items-center gap-1 ml-2 pl-2 border-l border-line">
            <span className="text-[11px] text-subtle">Ke hal:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder={String(currentPage)}
              className="w-12 h-8 px-1.5 text-center rounded-control bg-raised border border-line text-ink text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand tabular-nums"
            />
            <button
              type="submit"
              disabled={!jumpInput}
              className="h-8 px-2 rounded-control bg-tint text-brand-fg text-[11px] font-bold hover:bg-tint/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Go
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

/* ───────────────────────── Compact Top Pagination Bar ───────────────────────── */
export function CompactPagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'jadwal',
}: {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  itemLabel?: string
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="flex items-center gap-2 select-none">
      <div className="hidden md:flex items-center gap-1.5 text-xs text-subtle">
        <span>Menampilkan</span>
        <span className="font-bold text-ink tabular-nums">
          {start}–{end}
        </span>
        <span>dari</span>
        <span className="font-bold text-ink tabular-nums">{totalItems.toLocaleString('id-ID')}</span>
        <span>{itemLabel}</span>
      </div>

      <div className="flex items-center gap-1 bg-raised border border-line rounded-control p-0.5">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Halaman sebelumnya"
          className="w-7 h-7 rounded-control flex items-center justify-center text-subtle hover:text-ink hover:bg-page transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[15px]">chevron_left</span>
        </button>

        <span className="px-2 text-xs font-bold text-ink tabular-nums">
          {currentPage} <span className="text-subtle font-normal">/ {totalPages}</span>
        </span>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          title="Halaman berikutnya"
          className="w-7 h-7 rounded-control flex items-center justify-center text-subtle hover:text-ink hover:bg-page transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[15px]">chevron_right</span>
        </button>
      </div>
    </div>
  )
}

