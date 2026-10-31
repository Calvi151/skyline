import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'

/* ───────────────────────── Toast ───────────────────────── */
export type ToastState = { type: 'success' | 'error'; message: string } | null

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])
  return { toast, setToast }
}

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className="fixed bottom-6 right-6 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-3 pl-3 pr-2 py-2.5 rounded-control bg-ink text-page shadow-xl min-w-[280px]">
        <span
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
            ok ? 'bg-emerald-500' : 'bg-danger'
          } text-white`}
        >
          <span className="material-symbols-outlined text-[16px]">{ok ? 'check' : 'priority_high'}</span>
        </span>
        <span className="text-sm font-medium flex-1">{toast.message}</span>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-control flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Tutup"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  )
}

/* ───────────────────────── Copy Button ───────────────────────── */
export function CopyButton({ text, label = 'Salin' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* fallback silent */
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Tersalin ke clipboard!' : `Salin ${label}`}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-subtle hover:text-ink hover:bg-panel border border-transparent hover:border-line transition-all"
    >
      <span className="material-symbols-outlined text-[14px]">
        {copied ? 'check' : 'content_copy'}
      </span>
      <span>{copied ? 'Tersalin' : label}</span>
    </button>
  )
}

/* ───────────────────────── Profile Masthead (Enterprise SaaS) ───────────────────────── */
export function ProfileMasthead({
  initials,
  name,
  roleLabel,
  roleTone = 'brand',
  roleIcon = 'verified_user',
  email,
  userId,
  joinDate,
  statusLabel = 'Sesi aktif',
  statusTone = 'ok',
  actions,
}: {
  initials: string
  name?: string
  roleLabel: string
  roleTone?: 'brand' | 'signal' | 'ok'
  roleIcon?: string
  email?: string
  userId?: number | string
  joinDate?: string
  statusLabel?: string
  statusTone?: 'ok' | 'muted'
  actions?: React.ReactNode
}) {
  const toneMap = {
    brand: 'bg-brand/10 text-brand-fg border-brand/20',
    signal: 'bg-signal/10 text-signal border-signal/25',
    ok: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  }

  return (
    <div className="relative rounded-ticket border border-line bg-raised shadow-xs overflow-hidden">
      {/* Ambient background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-tint/35 via-panel to-raised pointer-events-none" />
      <div
        className="absolute top-0 right-0 w-80 h-36 bg-gradient-to-bl from-brand/10 to-transparent pointer-events-none rounded-bl-full"
        aria-hidden="true"
      />
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <pattern id="saas-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#saas-grid)" />
      </svg>

      {/* Main Content */}
      <div className="relative p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0">
          {/* Avatar with status indicator */}
          <div className="relative shrink-0 select-none">
            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-brand via-[#1a447a] to-chrome text-white flex items-center justify-center text-2xl sm:text-3xl font-extrabold shadow-md ring-4 ring-raised">
              {initials}
            </div>
            {statusTone === 'ok' && (
              <span
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-raised flex items-center justify-center shadow-xs"
                title="Status aktif"
              >
                <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-500/40 animate-pulse" />
              </span>
            )}
          </div>

          {/* User information */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink truncate">
                {name || 'Pengguna SkyBook'}
              </h1>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border ${
                  toneMap[roleTone]
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">{roleIcon}</span>
                {roleLabel}
              </span>
            </div>

            {/* Structured metadata chips */}
            <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap mt-2 text-xs text-subtle">
              {email && (
                <div className="flex items-center gap-1 font-mono text-[11px] sm:text-xs">
                  <span className="material-symbols-outlined text-[15px] text-subtle">mail</span>
                  <span className="text-ink font-medium">{email}</span>
                  <CopyButton text={email} label="Salin" />
                </div>
              )}
              {joinDate && (
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-subtle">calendar_today</span>
                  <span>Bergabung {joinDate}</span>
                </div>
              )}
              {userId !== undefined && (
                <div className="flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-panel border border-line text-subtle">
                  <span>ID #{userId}</span>
                </div>
              )}
              {statusLabel && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {statusLabel}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons slot */}
        {actions && <div className="shrink-0 flex items-center gap-2 pt-2 sm:pt-0">{actions}</div>}
      </div>
    </div>
  )
}

/* ───────────────────────── SaaS Tab Navigation ───────────────────────── */
export interface TabItem<T extends string> {
  id: T
  label: string
  icon: string
  count?: number | string
}

export function Tabs<T extends string>({
  items,
  active,
  onChange,
}: {
  items: TabItem<T>[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="border-b border-line overflow-x-auto">
      <div className="flex gap-2 min-w-max pb-px">
        {items.map((item) => {
          const isActive = item.id === active
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${
                isActive
                  ? 'border-brand text-brand-fg bg-tint/20 rounded-t-control'
                  : 'border-transparent text-subtle hover:text-ink hover:bg-panel/60 rounded-t-control'
              }`}
            >
              <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-brand-fg' : 'text-subtle'}`}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.count !== undefined && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-brand text-white' : 'bg-panel text-subtle border border-line'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ───────────────────────── Section Card ───────────────────────── */
export function Section({
  title,
  description,
  children,
  action,
  icon,
}: {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
  icon?: string
}) {
  return (
    <section className="bg-raised border border-line rounded-ticket shadow-xs overflow-hidden">
      <header className="px-5 sm:px-6 py-4 border-b border-line flex items-start justify-between gap-4 bg-panel/30">
        <div className="flex items-start gap-3">
          {icon && (
            <span className="w-8 h-8 rounded-control bg-panel border border-line text-subtle flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[18px]">{icon}</span>
            </span>
          )}
          <div>
            <h3 className="text-sm font-bold text-ink tracking-tight">{title}</h3>
            {description && <p className="text-xs text-subtle mt-0.5 leading-relaxed">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="divide-y divide-line">{children}</div>
    </section>
  )
}

/* ───────────────────────── Inline Editable Row ───────────────────────── */
export function EditableRow({
  label,
  hint,
  value,
  placeholder,
  prefix,
  type = 'text',
  locked,
  lockedNote,
  onSave,
}: {
  label: string
  hint?: string
  value: string
  placeholder?: string
  prefix?: string
  type?: string
  locked?: boolean
  lockedNote?: string
  onSave?: (v: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const dirty = draft.trim() !== (value || '').trim()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onSave || !dirty) return setEditing(false)
    setSaving(true)
    try {
      await onSave(draft.trim())
      setEditing(false)
    } catch {
      /* toast handled by caller */
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`px-5 sm:px-6 py-4.5 transition-colors ${editing ? 'bg-tint/25' : 'hover:bg-panel/40'}`}>
      {!editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-center">
          <div className="sm:col-span-4">
            <span className="text-xs font-semibold text-ink block">{label}</span>
            {hint && <span className="text-[11px] text-subtle block mt-0.5">{hint}</span>}
          </div>
          <div className="sm:col-span-6 min-w-0">
            {value ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink break-words">
                  {prefix && <span className="text-subtle mr-1">{prefix}</span>}
                  {value}
                </span>
                {locked && <CopyButton text={value} />}
              </div>
            ) : (
              <span className="text-sm text-subtle italic">Belum diisi</span>
            )}
            {locked && lockedNote && (
              <span className="inline-flex items-center gap-1 text-[11px] text-subtle mt-1 px-2 py-0.5 rounded bg-panel border border-line">
                <span className="material-symbols-outlined text-[13px]">lock</span>
                {lockedNote}
              </span>
            )}
          </div>
          <div className="sm:col-span-2 flex sm:justify-end">
            {!locked && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="h-8 px-3 rounded-control border border-line bg-raised hover:bg-panel text-xs font-semibold text-ink hover:text-brand-fg transition-all"
              >
                {value ? 'Ubah' : 'Tambah'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3 animate-in fade-in duration-150 max-w-xl">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-ink">{label}</label>
            {hint && <span className="text-[11px] text-subtle">{hint}</span>}
          </div>
          <div className="flex">
            {prefix && (
              <span className="h-10 px-3.5 flex items-center rounded-l-control border border-r-0 border-line bg-panel text-sm font-semibold text-subtle">
                {prefix}
              </span>
            )}
            <input
              autoFocus
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
              className={`w-full h-10 px-3.5 border border-line bg-raised text-ink text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all ${
                prefix ? 'rounded-r-control' : 'rounded-control'
              }`}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="h-8 px-3 rounded-control text-xs font-semibold text-subtle hover:text-ink hover:bg-panel transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || !dirty}
              className="h-8 px-4 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-xs"
            >
              {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Simpan Perubahan
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/* ───────────────────────── Static Info Row ───────────────────────── */
export function InfoRow({
  icon,
  title,
  description,
  right,
}: {
  icon: string
  title: string
  description?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="px-5 sm:px-6 py-4 flex items-center gap-4 hover:bg-panel/40 transition-colors">
      <span className="w-9 h-9 rounded-control bg-panel border border-line text-subtle flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-ink block">{title}</span>
        {description && <div className="text-xs text-subtle block mt-0.5 leading-relaxed">{description}</div>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

/* ───────────────────────── Status Pill ───────────────────────── */
export function StatusPill({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'muted' | 'brand'
  children: React.ReactNode
}) {
  const cls =
    tone === 'ok'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
      : tone === 'warn'
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
        : tone === 'brand'
          ? 'bg-brand/10 text-brand-fg border-brand/20'
          : 'bg-panel text-subtle border-line'

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cls}`}>
      {children}
    </span>
  )
}

/* ───────────────────────── Password Accordion Row ───────────────────────── */
function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 pl-3.5 pr-10 rounded-control border border-line bg-raised text-ink text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-ink"
        tabIndex={-1}
        title={show ? 'Sembunyikan' : 'Tampilkan'}
      >
        <span className="material-symbols-outlined text-[18px]">{show ? 'visibility_off' : 'visibility'}</span>
      </button>
    </div>
  )
}

export function PasswordRow({
  hasPassword,
  onToast,
}: {
  hasPassword: boolean
  onToast: (t: ToastState) => void
}) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const checks = useMemo(
    () => [
      { label: 'Minimal 8 karakter', ok: next.length >= 8 },
      { label: 'Huruf besar', ok: /[A-Z]/.test(next) },
      { label: 'Angka', ok: /[0-9]/.test(next) },
      { label: 'Simbol khusus', ok: /[^A-Za-z0-9]/.test(next) },
    ],
    [next],
  )
  const score = checks.filter((c) => c.ok).length
  const meterColor = ['bg-line', 'bg-danger', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600'][score]
  const matches = confirm.length > 0 && confirm === next

  const reset = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setOpen(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next.length < 6) return onToast({ type: 'error', message: 'Kata sandi baru minimal 6 karakter' })
    if (!matches) return onToast({ type: 'error', message: 'Konfirmasi kata sandi tidak cocok' })
    setSaving(true)
    try {
      await api.put('/auth/change-password', { current_password: current, new_password: next })
      onToast({ type: 'success', message: 'Kata sandi berhasil diperbarui' })
      reset()
    } catch (err: any) {
      onToast({ type: 'error', message: err?.response?.data?.message || 'Gagal memperbarui kata sandi' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <InfoRow
        icon="key"
        title="Kata sandi akun"
        description={
          hasPassword
            ? '••••••••••••  ·  Digunakan untuk otentikasi login email'
            : 'Belum diatur — akun terhubung langsung via SSO Google'
        }
        right={
          <button
            type="button"
            onClick={() => (open ? reset() : setOpen(true))}
            className="h-8 px-3 rounded-control border border-line bg-raised hover:bg-panel text-xs font-semibold text-ink hover:text-brand-fg transition-all"
          >
            {open ? 'Batal' : hasPassword ? 'Ganti Sandi' : 'Atur Sandi'}
          </button>
        }
      />
      <div
        className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <form onSubmit={submit} className="px-5 sm:px-6 pb-5 pt-2 sm:pl-[68px] space-y-3 max-w-xl">
            {hasPassword && (
              <div>
                <label className="text-xs font-semibold text-ink block mb-1">Kata sandi saat ini</label>
                <PasswordInput value={current} onChange={setCurrent} placeholder="Masukkan sandi lama" />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-ink block mb-1">Kata sandi baru</label>
              <PasswordInput value={next} onChange={setNext} placeholder="Minimal 8 karakter" />
            </div>

            {next.length > 0 && (
              <div className="space-y-2 p-3 rounded-control bg-panel border border-line">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">Kekuatan kata sandi</span>
                  <span className="text-[11px] text-subtle">{score}/4 kriteria terpenuhi</span>
                </div>
                <div className="flex gap-1 h-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={`flex-1 rounded-full transition-colors ${i < score ? meterColor : 'bg-line'}`} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {checks.map((c) => (
                    <span
                      key={c.label}
                      className={`flex items-center gap-1.5 text-[11px] transition-colors ${
                        c.ok ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-subtle'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">{c.ok ? 'check_circle' : 'radio_button_unchecked'}</span>
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-ink block mb-1">Konfirmasi kata sandi baru</label>
              <PasswordInput value={confirm} onChange={setConfirm} placeholder="Ulangi kata sandi baru" />
            </div>
            {confirm.length > 0 && !matches && (
              <span className="text-[11px] text-danger font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">error</span>
                Konfirmasi kata sandi belum sama
              </span>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={reset}
                className="h-8 px-3 rounded-control text-xs font-semibold text-subtle hover:text-ink hover:bg-panel"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving || !matches || next.length < 6 || (hasPassword && !current)}
                className="h-8 px-4 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-xs"
              >
                {saving && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Perbarui Kata Sandi
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── Profile Completion Ring ───────────────────────── */
export function CompletionRing({ percent }: { percent: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-line" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (percent / 100) * c}
          className="stroke-brand-fg transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-ink tabular-nums">
        {percent}%
      </span>
    </div>
  )
}

/* ───────────────────────── Utility Helpers ───────────────────────── */
export function getInitials(name?: string) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export function formatJoinDate(iso?: string) {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return '-'
  }
}
