import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AdminLayout from '../../components/layout/AdminLayout'
import { api } from '../../lib/api'

interface AirportItem {
  id: number
  code: string
  name: string
  city: string
}

interface AirlineItem {
  id: number
  name: string
  code: string
  logo?: string | null
}

interface AirplaneItem {
  id: number
  airlineId: number
  registrationNumber: string
  model: string
  totalSeatEconomy: number
  totalSeatBusiness?: number | null
}

interface SegmentFormState {
  id?: number
  segment_order: number
  origin_airport_id: number | ''
  destination_airport_id: number | ''
  departure_time: string // ISO string or datetime-local
  arrival_time: string
  transit_duration_minutes?: number | null
}

export default function FlightFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  // Reference data
  const [airports, setAirports] = useState<AirportItem[]>([])
  const [airlines, setAirlines] = useState<AirlineItem[]>([])
  const [airplanes, setAirplanes] = useState<AirplaneItem[]>([])

  // Form states
  const [flightNumber, setFlightNumber] = useState('')
  const [airlineId, setAirlineId] = useState<number | ''>('')
  const [airplaneId, setAirplaneId] = useState<number | ''>('')
  const [flightType, setFlightType] = useState<'direct' | 'transit'>('direct')
  const [priceEconomy, setPriceEconomy] = useState<number | ''>(1450000)
  const [priceBusiness, setPriceBusiness] = useState<number | ''>(3200000)
  const [segments, setSegments] = useState<SegmentFormState[]>([
    {
      segment_order: 1,
      origin_airport_id: '',
      destination_airport_id: '',
      departure_time: '',
      arrival_time: '',
    },
  ])

  // Lock status for edit mode if flight has bookings
  const [hasBookings, setHasBookings] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  // Load master data (airports, airlines, airplanes)
  useEffect(() => {
    const fetchReferences = async () => {
      try {
        const [airportsRes, airlinesRes, airplanesRes] = await Promise.all([
          api.get('/admin/airports').catch(() => ({ data: [] })),
          api.get('/admin/airlines').catch(() => ({ data: [] })),
          api.get('/admin/airplanes').catch(() => ({ data: [] })),
        ])

        const airportList: AirportItem[] = Array.isArray((airportsRes as any)?.data)
          ? (airportsRes as any).data
          : []
        const airlineList: AirlineItem[] = Array.isArray((airlinesRes as any)?.data)
          ? (airlinesRes as any).data
          : []
        const airplaneList: AirplaneItem[] = Array.isArray((airplanesRes as any)?.data)
          ? (airplanesRes as any).data
          : []

        setAirports(airportList)
        setAirlines(airlineList)
        setAirplanes(airplaneList)

        // Set default airports for segment 1 if available
        if (!isEdit && airportList.length >= 2) {
          const cgk = airportList.find((a) => a.code === 'CGK') || airportList[0]
          const dps = airportList.find((a) => a.code === 'DPS') || airportList[1]
          setSegments([
            {
              segment_order: 1,
              origin_airport_id: cgk.id,
              destination_airport_id: dps.id,
              departure_time: '2026-10-24T06:15',
              arrival_time: '2026-10-24T07:55',
            },
          ])
        }

        // Set default airline & airplane
        if (!isEdit && airlineList.length > 0) {
          setAirlineId(airlineList[0].id)
          const matchedPlanes = airplaneList.filter((p) => p.airlineId === airlineList[0].id)
          if (matchedPlanes.length > 0) {
            setAirplaneId(matchedPlanes[0].id)
          }
        }

        // If Edit mode, fetch current flight schedule
        if (isEdit && id) {
          const flightRes: any = await api.get(`/admin/flights/${id}`)
          const data = flightRes?.data
          if (data) {
            setFlightNumber(data.flightNumber || '')
            setAirlineId(data.airline?.id || '')
            setAirplaneId(data.airplane?.id || '')
            setFlightType(data.flightType || 'direct')
            setPriceEconomy(Number(data.priceEconomy) || 0)
            setPriceBusiness(data.priceBusiness ? Number(data.priceBusiness) : '')

            if (data.seatStats && data.seatStats.booked > 0) {
              setHasBookings(true)
            }

            if (Array.isArray(data.segments) && data.segments.length > 0) {
              setSegments(
                data.segments.map((seg: any) => ({
                  id: seg.id,
                  segment_order: seg.segmentOrder,
                  origin_airport_id: seg.originAirport?.id || seg.originAirportId,
                  destination_airport_id: seg.destinationAirport?.id || seg.destinationAirportId,
                  departure_time: seg.departureTime ? seg.departureTime.slice(0, 16) : '',
                  arrival_time: seg.arrivalTime ? seg.arrivalTime.slice(0, 16) : '',
                  transit_duration_minutes: seg.transitDurationMinutes,
                }))
              )
            }
          }
        }
      } catch (err: any) {
        console.error('Failed to initialize references:', err)
        setErrorMessage('Gagal memuat data referensi bandara dan armada.')
      }
    }

    fetchReferences()
  }, [id, isEdit])

  // Filter airplanes by selected airline
  const filteredAirplanes = useMemo(() => {
    if (!airlineId) return airplanes
    return airplanes.filter((p) => p.airlineId === Number(airlineId))
  }, [airplanes, airlineId])

  // Current selected airplane object
  const currentAirplane = useMemo(() => {
    return airplanes.find((p) => p.id === Number(airplaneId))
  }, [airplanes, airplaneId])

  // Current selected airline object
  const currentAirline = useMemo(() => {
    return airlines.find((a) => a.id === Number(airlineId))
  }, [airlines, airlineId])

  // Total seat capacity
  const totalSeats = useMemo(() => {
    if (!currentAirplane) return 180
    return (currentAirplane.totalSeatEconomy || 0) + (currentAirplane.totalSeatBusiness || 0)
  }, [currentAirplane])

  // Handle airline change: also update airplane selection to first matching plane
  const handleAirlineChange = (newAirlineId: number) => {
    setAirlineId(newAirlineId)
    const matching = airplanes.filter((p) => p.airlineId === newAirlineId)
    if (matching.length > 0) {
      setAirplaneId(matching[0].id)
    } else {
      setAirplaneId('')
    }
  }

  // Handle flight type toggle
  const handleTypeChange = (newType: 'direct' | 'transit') => {
    setFlightType(newType)
    if (newType === 'direct') {
      // Keep only first segment
      setSegments((prev) => [prev[0]])
    } else if (newType === 'transit' && segments.length === 1) {
      // Add second segment automatically
      const seg1 = segments[0]
      const origin2 = seg1.destination_airport_id
      const remainingAirports = airports.filter(
        (a) => a.id !== seg1.origin_airport_id && a.id !== origin2
      )
      const dest2 = remainingAirports.length > 0 ? remainingAirports[0].id : airports[0]?.id || ''

      // Calculate sample times for segment 2
      let dep2 = ''
      let arr2 = ''
      if (seg1.arrival_time) {
        const arrDate = new Date(seg1.arrival_time)
        const depDate = new Date(arrDate.getTime() + 65 * 60 * 1000) // 1h 5m transit
        const arr2Date = new Date(depDate.getTime() + 110 * 60 * 1000) // 1h 50m flight
        dep2 = depDate.toISOString().slice(0, 16)
        arr2 = arr2Date.toISOString().slice(0, 16)
      }

      setSegments([
        seg1,
        {
          segment_order: 2,
          origin_airport_id: origin2,
          destination_airport_id: dest2,
          departure_time: dep2,
          arrival_time: arr2,
        },
      ])
    }
  }

  // Add transit segment
  const addSegment = () => {
    const lastSeg = segments[segments.length - 1]
    const nextOrder = segments.length + 1
    const nextOrigin = lastSeg?.destination_airport_id || ''
    const remaining = airports.filter((a) => a.id !== nextOrigin)
    const nextDest = remaining.length > 0 ? remaining[0].id : ''

    let nextDep = ''
    let nextArr = ''
    if (lastSeg?.arrival_time) {
      const arrDate = new Date(lastSeg.arrival_time)
      const depDate = new Date(arrDate.getTime() + 60 * 60 * 1000)
      const arr2Date = new Date(depDate.getTime() + 90 * 60 * 1000)
      nextDep = depDate.toISOString().slice(0, 16)
      nextArr = arr2Date.toISOString().slice(0, 16)
    }

    setSegments([
      ...segments,
      {
        segment_order: nextOrder,
        origin_airport_id: nextOrigin,
        destination_airport_id: nextDest,
        departure_time: nextDep,
        arrival_time: nextArr,
      },
    ])
  }

  // Remove segment
  const removeSegment = (indexToRemove: number) => {
    if (segments.length <= 1) return
    const updated = segments
      .filter((_, idx) => idx !== indexToRemove)
      .map((seg, idx) => ({
        ...seg,
        segment_order: idx + 1,
      }))
    setSegments(updated)
    if (updated.length === 1) {
      setFlightType('direct')
    }
  }

  // Update specific segment
  const updateSegment = (index: number, patch: Partial<SegmentFormState>) => {
    setSegments((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }

      // If changing destination of segment N, automatically update origin of segment N+1
      if (patch.destination_airport_id !== undefined && next[index + 1]) {
        next[index + 1] = {
          ...next[index + 1],
          origin_airport_id: patch.destination_airport_id,
        }
      }

      return next
    })
  }

  // Calculate duration string helper
  const getDurationString = (startStr?: string, endStr?: string) => {
    if (!startStr || !endStr) return '--'
    try {
      const start = new Date(startStr).getTime()
      const end = new Date(endStr).getTime()
      if (isNaN(start) || isNaN(end) || end <= start) return '--'

      const diffMins = Math.round((end - start) / (1000 * 60))
      const hours = Math.floor(diffMins / 60)
      const mins = diffMins % 60
      if (hours > 0 && mins > 0) return `${hours}j ${mins}m`
      if (hours > 0) return `${hours} jam`
      return `${mins} menit`
    } catch {
      return '--'
    }
  }

  // Calculate transit duration helper between segment i arrival and segment i+1 departure
  const getTransitDurationString = (seg1Arrival?: string, seg2Departure?: string) => {
    if (!seg1Arrival || !seg2Departure) return '1j 00m'
    try {
      const arr = new Date(seg1Arrival).getTime()
      const dep = new Date(seg2Departure).getTime()
      if (isNaN(arr) || isNaN(dep) || dep <= arr) return '0 menit'

      const diffMins = Math.round((dep - arr) / (1000 * 60))
      const hours = Math.floor(diffMins / 60)
      const mins = diffMins % 60
      if (hours > 0 && mins > 0) return `${hours}j ${String(mins).padStart(2, '0')}m`
      if (hours > 0) return `${hours} jam`
      return `${mins} menit`
    } catch {
      return '1j 00m'
    }
  }

  // Total journey duration from first departure to last arrival
  const totalJourneyDuration = useMemo(() => {
    const first = segments[0]
    const last = segments[segments.length - 1]
    return getDurationString(first?.departure_time, last?.arrival_time)
  }, [segments])

  // Get Airport By ID Helper
  const getAirport = (aid?: number | '') => {
    return airports.find((a) => a.id === Number(aid))
  }

  // Format Time Only
  const formatTimeOnly = (dateTimeStr?: string) => {
    if (!dateTimeStr) return '--:--'
    try {
      const d = new Date(dateTimeStr)
      if (isNaN(d.getTime())) return '--:--'
      const h = String(d.getHours()).padStart(2, '0')
      const m = String(d.getMinutes()).padStart(2, '0')
      return `${h}.${m}`
    } catch {
      return '--:--'
    }
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    // Form Validations
    if (!flightNumber.trim()) {
      setErrorMessage('Nomor penerbangan wajib diisi (misal: KA 220).')
      return
    }
    if (!airlineId) {
      setErrorMessage('Silakan pilih maskapai pengelola.')
      return
    }
    if (!airplaneId) {
      setErrorMessage('Silakan pilih unit armada pesawat.')
      return
    }
    if (!priceEconomy || Number(priceEconomy) <= 0) {
      setErrorMessage('Harga kelas ekonomi harus lebih dari Rp 0.')
      return
    }

    if (flightType === 'direct' && segments.length !== 1) {
      setErrorMessage('Penerbangan langsung harus memiliki tepat 1 segmen.')
      return
    }
    if (flightType === 'transit' && segments.length < 2) {
      setErrorMessage('Penerbangan transit harus memiliki minimal 2 segmen.')
      return
    }

    // Validate segments
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      if (!seg.origin_airport_id || !seg.destination_airport_id) {
        setErrorMessage(`Segmen ${i + 1}: Bandara asal dan tujuan wajib dipilih.`)
        return
      }
      if (seg.origin_airport_id === seg.destination_airport_id) {
        setErrorMessage(`Segmen ${i + 1}: Bandara asal tidak boleh sama dengan tujuan.`)
        return
      }
      if (!seg.departure_time || !seg.arrival_time) {
        setErrorMessage(`Segmen ${i + 1}: Waktu keberangkatan dan kedatangan wajib diisi.`)
        return
      }

      const depDate = new Date(seg.departure_time)
      const arrDate = new Date(seg.arrival_time)
      if (arrDate <= depDate) {
        setErrorMessage(`Segmen ${i + 1}: Waktu kedatangan harus setelah waktu keberangkatan.`)
        return
      }

      // Check transit continuity
      if (i > 0) {
        const prevSeg = segments[i - 1]
        const prevArr = new Date(prevSeg.arrival_time)
        if (seg.origin_airport_id !== prevSeg.destination_airport_id) {
          setErrorMessage(
            `Segmen ${i + 1}: Bandara asal harus sama dengan bandara kedatangan segmen ${i}.`
          )
          return
        }
        if (depDate <= prevArr) {
          setErrorMessage(
            `Segmen ${i + 1}: Waktu berangkat transit harus setelah kedatangan segmen sebelumnya.`
          )
          return
        }
      }
    }

    setSubmitting(true)

    // Build payload
    const formattedSegments = segments.map((seg, idx) => {
      let transitMins: number | null = null
      if (idx > 0) {
        const prevArr = new Date(segments[idx - 1].arrival_time).getTime()
        const curDep = new Date(seg.departure_time).getTime()
        transitMins = Math.max(0, Math.round((curDep - prevArr) / (1000 * 60)))
      }
      return {
        segment_order: seg.segment_order,
        origin_airport_id: Number(seg.origin_airport_id),
        destination_airport_id: Number(seg.destination_airport_id),
        departure_time: new Date(seg.departure_time).toISOString(),
        arrival_time: new Date(seg.arrival_time).toISOString(),
        transit_duration_minutes: transitMins,
      }
    })

    const payload = {
      flight_number: flightNumber.trim().toUpperCase(),
      airline_id: Number(airlineId),
      airplane_id: Number(airplaneId),
      flight_type: flightType,
      price_economy: Number(priceEconomy),
      price_business: priceBusiness ? Number(priceBusiness) : null,
      status: 'scheduled',
      segments: formattedSegments,
    }

    try {
      if (isEdit && id) {
        await api.put(`/admin/flights/${id}`, {
          flight_number: payload.flight_number,
          price_economy: payload.price_economy,
          price_business: payload.price_business,
        })
        setSuccessToast('Jadwal penerbangan berhasil diperbarui!')
      } else {
        await api.post('/admin/flights', payload)
        setSuccessToast('Jadwal penerbangan & alokasi kursi berhasil dibuat!')
      }

      setTimeout(() => {
        navigate('/admin/flights')
      }, 1200)
    } catch (err: any) {
      console.error('Submit flight error:', err)
      setErrorMessage(
        err?.message ||
          'Gagal menyimpan jadwal penerbangan. Pastikan seluruh slot rute dan kapasitas valid.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AdminLayout>
      <div className="w-full max-w-[1360px] mx-auto px-6 lg:px-8 py-8 space-y-6 pb-28">
        {/* ─── Breadcrumb & Top Page Header ─── */}
        <section className="flex flex-col gap-2">
          <Link
            to="/admin/flights"
            className="inline-flex items-center gap-1.5 text-subtle hover:text-brand-fg transition-colors text-xs font-semibold w-fit group"
          >
            <span className="material-symbols-outlined text-[18px] transition-transform group-hover:-translate-x-1">
              arrow_back
            </span>
            <span>Kembali ke daftar jadwal</span>
          </Link>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-1">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-ink tracking-tight">
                {isEdit ? 'Ubah Jadwal Penerbangan' : 'Tambah Jadwal Penerbangan'}
              </h1>
              <p className="text-sm text-subtle mt-1">
                Konfigurasikan armada, nomor penerbangan, dan rute multi-segmen (transit) dengan
                presisi operasional.
              </p>
            </div>
            <div className="hidden xl:flex items-center gap-2 bg-panel border border-line px-3.5 py-1.5 rounded-control shadow-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold text-subtle uppercase tracking-wider">
                Sistem Validasi Slot IATA Aktif
              </span>
            </div>
          </div>
        </section>

        {/* Existing Bookings Warning */}
        {hasBookings && (
          <div className="p-4 rounded-ticket bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-3 animate-in fade-in">
            <span className="material-symbols-outlined text-[24px] text-amber-600 dark:text-amber-400 shrink-0">
              lock
            </span>
            <div>
              <span className="font-bold block text-sm">Jadwal Memiliki Pemesanan Tiket</span>
              <span>
                Harga, armada pesawat, dan segmen rute dikunci untuk menjaga integritas tiket
                penumpang yang telah terbit.
              </span>
            </div>
          </div>
        )}

        {/* Form Error Banner */}
        {errorMessage && (
          <div className="p-4 rounded-ticket bg-danger/10 border border-danger/30 text-danger text-sm font-medium flex items-center gap-3 animate-in fade-in">
            <span className="material-symbols-outlined text-[22px] shrink-0">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ─── Two-Column Grid Setup: Left 5 cols (~480px), Right 7 cols (~660px+) ─── */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ════ LEFT COLUMN: Flight Configuration Form ════ */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-panel border border-line rounded-ticket p-6 shadow-sm flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h2 className="font-bold text-ink text-base">Spesifikasi Armada & Tiket</h2>
                <span className="text-[11px] font-bold bg-tint text-brand-fg px-2.5 py-1 rounded">
                  Langkah 1/2
                </span>
              </div>

              {/* 1. Nomor Penerbangan */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-subtle uppercase tracking-wider">
                  Nomor Penerbangan
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-subtle text-xl pointer-events-none">
                    flight
                  </span>
                  <input
                    type="text"
                    required
                    value={flightNumber}
                    disabled={hasBookings}
                    onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
                    placeholder="Contoh: KA 220"
                    className="w-full h-12 pl-11 pr-4 bg-page border border-line text-ink text-sm rounded-control focus:outline-none focus:ring-2 focus:ring-brand-fg/30 uppercase tracking-wide font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* 2. Maskapai Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-subtle uppercase tracking-wider">
                  Maskapai Pengelola
                </label>
                <div className="relative">
                  <select
                    value={airlineId}
                    disabled={hasBookings}
                    onChange={(e) => handleAirlineChange(Number(e.target.value))}
                    className="w-full h-12 px-4 appearance-none bg-page border border-line text-ink text-sm rounded-control focus:outline-none focus:ring-2 focus:ring-brand-fg/30 cursor-pointer font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">Pilih Maskapai</option>
                    {airlines.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.code}) - Operasional Domestik
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3.5 top-3.5 text-subtle pointer-events-none text-xl">
                    expand_more
                  </span>
                </div>
              </div>

              {/* 3. Pesawat & Capacity Info Pill */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-subtle uppercase tracking-wider">
                  Unit Armada Pesawat
                </label>
                <div className="relative">
                  <select
                    value={airplaneId}
                    disabled={hasBookings}
                    onChange={(e) => setAirplaneId(Number(e.target.value))}
                    className="w-full h-12 px-4 appearance-none bg-page border border-line text-ink text-sm rounded-control focus:outline-none focus:ring-2 focus:ring-brand-fg/30 cursor-pointer font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">Pilih Unit Pesawat</option>
                    {filteredAirplanes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.model} ({p.registrationNumber}) • {p.totalSeatEconomy} Eco
                        {p.totalSeatBusiness ? `, ${p.totalSeatBusiness} Biz` : ''}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3.5 top-3.5 text-subtle pointer-events-none text-xl">
                    expand_more
                  </span>
                </div>

                {/* Capacity Fern Indicator Pill */}
                {currentAirplane && (
                  <div className="mt-1 flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-control text-xs">
                    <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-lg">
                      check_circle
                    </span>
                    <span className="text-ink font-medium">
                      Kapasitas terdaftar:{' '}
                      <strong className="text-ink">
                        {currentAirplane.totalSeatEconomy} ekonomi
                      </strong>
                      ,{' '}
                      <strong className="text-ink">
                        {currentAirplane.totalSeatBusiness || 0} bisnis
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* 4. Tipe Operasi Penerbangan (Segmented Control) */}
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-xs font-bold text-subtle uppercase tracking-wider">
                  Tipe Operasi Penerbangan
                </span>
                <div className="grid grid-cols-2 p-1 bg-page border border-line rounded-control gap-1">
                  <button
                    type="button"
                    disabled={hasBookings}
                    onClick={() => handleTypeChange('direct')}
                    className={`py-2 px-3 rounded text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      flightType === 'direct'
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-subtle hover:text-ink'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">flight_takeoff</span>
                    <span>Langsung</span>
                  </button>
                  <button
                    type="button"
                    disabled={hasBookings}
                    onClick={() => handleTypeChange('transit')}
                    className={`py-2 px-3 rounded text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      flightType === 'transit'
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-subtle hover:text-ink'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">alt_route</span>
                    <span>Transit (Multi-segmen)</span>
                  </button>
                </div>
              </div>

              {/* 5. Struktur Tarif Dasar */}
              <div className="flex flex-col gap-2 pt-1">
                <span className="text-xs font-bold text-subtle uppercase tracking-wider">
                  Struktur Tarif Dasar
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-subtle">Harga Ekonomi</label>
                    <div className="relative flex items-center">
                      <span className="text-xs font-bold text-subtle absolute left-3">IDR</span>
                      <input
                        type="number"
                        min="0"
                        required
                        disabled={hasBookings}
                        value={priceEconomy}
                        onChange={(e) => setPriceEconomy(Number(e.target.value))}
                        className="w-full h-11 pl-11 pr-3 bg-page border border-line text-ink font-bold tabular-nums text-sm rounded-control focus:outline-none focus:ring-2 focus:ring-brand-fg/30 text-right disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-subtle">Harga Bisnis</label>
                    <div className="relative flex items-center">
                      <span className="text-xs font-bold text-subtle absolute left-3">IDR</span>
                      <input
                        type="number"
                        min="0"
                        disabled={hasBookings || !currentAirplane?.totalSeatBusiness}
                        value={priceBusiness}
                        onChange={(e) =>
                          setPriceBusiness(e.target.value ? Number(e.target.value) : '')
                        }
                        placeholder="Opsional"
                        className="w-full h-11 pl-11 pr-3 bg-page border border-line text-ink font-bold tabular-nums text-sm rounded-control focus:outline-none focus:ring-2 focus:ring-brand-fg/30 text-right disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. Otomasi Sistem Info Checkboxes */}
              <div className="flex flex-col gap-2.5 pt-3 bg-page/60 border border-line/60 p-4 rounded-control text-xs">
                <span className="font-bold text-subtle uppercase tracking-wider">
                  Otomasi Sistem
                </span>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="mt-0.5 w-4 h-4 rounded text-brand accent-brand cursor-pointer"
                  />
                  <span className="text-ink leading-snug">
                    Buka penjualan tiket segera setelah jadwal disimpan ke GDS
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="mt-0.5 w-4 h-4 rounded text-brand accent-brand cursor-pointer"
                  />
                  <span className="text-ink leading-snug">
                    Aktifkan alokasi kursi otomatis (auto-seat assignment engine)
                  </span>
                </label>
              </div>
            </div>

            {/* Quick Aviation Compliance Card */}
            <div className="bg-panel border border-line rounded-ticket p-4 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-control bg-tint text-brand-fg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-ink">Regulasi Aviasi Terpenuhi</p>
                  <p className="text-[11px] text-subtle">CASR Bagian 121 Republik Indonesia</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-subtle text-[18px]">
                help_outline
              </span>
            </div>
          </div>

          {/* ════ RIGHT COLUMN: Segments, Timeline & Live Preview ════ */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-panel border border-line rounded-ticket p-6 shadow-sm flex flex-col gap-6">
              <div className="flex flex-col gap-1 border-b border-line pb-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-ink text-base">Segmen Perjalanan & Rute</h2>
                  <span className="text-xs font-bold text-brand-fg bg-tint px-2.5 py-1 rounded">
                    Total {segments.length} Segmen Rute
                  </span>
                </div>
                <p className="text-xs text-subtle">
                  Atur urutan keberangkatan, slot kedatangan, dan kalkulasi durasi transit antar kota.
                </p>
              </div>

              {/* ─── Vertical Timeline Architecture ─── */}
              <div className="relative pl-6 flex flex-col gap-5">
                {/* Continuous Line Behind Dots */}
                <div className="absolute left-2.5 top-6 bottom-6 w-0.5 bg-line -translate-x-1/2" />

                {segments.map((seg, idx) => {
                  const isFirst = idx === 0
                  const isLast = idx === segments.length - 1
                  const flightDuration = getDurationString(seg.departure_time, seg.arrival_time)
                  const originAirport = getAirport(seg.origin_airport_id)

                  return (
                    <React.Fragment key={idx}>
                      {/* Layover Divider Block between Segments */}
                      {idx > 0 && (
                        <div className="relative py-1 animate-in fade-in">
                          {/* Pin Icon */}
                          <div className="absolute -left-6 top-1/2 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center -translate-x-1/2 -translate-y-1/2 shadow-xs z-10 text-[11px]">
                            <span className="material-symbols-outlined text-[12px]">
                              hourglass_top
                            </span>
                          </div>

                          {/* Transit Info Banner */}
                          <div className="bg-amber-500/10 border border-amber-500/30 rounded-control p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-panel text-brand-fg flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[18px]">
                                  transfer_within_a_station
                                </span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-ink">
                                    Transit di {originAirport?.city || 'Bandara'} (
                                    {originAirport?.code || '---'})
                                  </span>
                                  <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                                    {getTransitDurationString(
                                      segments[idx - 1].arrival_time,
                                      seg.departure_time
                                    )}
                                  </span>
                                </div>
                                <p className="text-[11px] text-subtle">
                                  Koneksi bagasi terusan (through check-in) otomatis ke penerbangan
                                  lanjutan
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* SEGMENT CARD */}
                      <div className="relative flex flex-col gap-2">
                        {/* Timeline Pin */}
                        <div className="absolute -left-6 top-3 w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center -translate-x-1/2 shadow-xs ring-4 ring-panel z-10 font-bold text-[10px]">
                          {idx + 1}
                        </div>

                        {/* Segment Container */}
                        <div className="bg-page border border-line rounded-ticket overflow-hidden shadow-xs">
                          {/* Header */}
                          <div className="bg-panel px-4 py-2.5 border-b border-line flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-bold text-brand-fg uppercase tracking-wider">
                                Segmen {idx + 1}
                              </span>
                              <span className="text-subtle">
                                • {isFirst ? 'Keberangkatan Awal' : isLast ? 'Penerbangan Akhir' : 'Penerbangan Lanjutan'}
                              </span>
                            </div>

                            {/* Delete segment button */}
                            {idx > 0 && !hasBookings ? (
                              <button
                                type="button"
                                onClick={() => removeSegment(idx)}
                                className="text-danger hover:text-red-700 flex items-center gap-1 text-xs font-semibold transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  delete
                                </span>
                                <span>Hapus segmen</span>
                              </button>
                            ) : (
                              <span className="text-subtle text-xs flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">
                                  lock
                                </span>
                                <span>Terkunci</span>
                              </span>
                            )}
                          </div>

                          {/* Body */}
                          <div className="p-4 flex flex-col gap-4">
                            {/* Origin & Destination Rows */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Origin Airport */}
                              <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-bold text-subtle uppercase">
                                  Dari (Origin)
                                </span>
                                <select
                                  value={seg.origin_airport_id}
                                  disabled={hasBookings || idx > 0} // Origin of transit segment is locked to previous destination
                                  onChange={(e) =>
                                    updateSegment(idx, {
                                      origin_airport_id: Number(e.target.value),
                                    })
                                  }
                                  className="w-full h-11 px-3 bg-panel border border-line rounded-control text-ink text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-fg/30 disabled:opacity-70"
                                >
                                  <option value="">Pilih Bandara Asal</option>
                                  {airports.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.code} - {a.city} ({a.name})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Destination Airport */}
                              <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-bold text-subtle uppercase">
                                  Ke ({isLast ? 'Tujuan Akhir' : 'Transit Point'})
                                </span>
                                <select
                                  value={seg.destination_airport_id}
                                  disabled={hasBookings}
                                  onChange={(e) =>
                                    updateSegment(idx, {
                                      destination_airport_id: Number(e.target.value),
                                    })
                                  }
                                  className="w-full h-11 px-3 bg-panel border border-line rounded-control text-ink text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-fg/30 disabled:opacity-70"
                                >
                                  <option value="">Pilih Bandara Tujuan</option>
                                  {airports.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.code} - {a.city} ({a.name})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Departure & Arrival Datetime Pickers */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                              <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-bold text-subtle">
                                  Waktu Berangkat
                                </span>
                                <input
                                  type="datetime-local"
                                  required
                                  disabled={hasBookings}
                                  value={seg.departure_time}
                                  onChange={(e) =>
                                    updateSegment(idx, { departure_time: e.target.value })
                                  }
                                  className="w-full h-10 px-2.5 bg-panel border border-line rounded-control text-ink text-xs font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-fg/30 disabled:opacity-70"
                                />
                              </div>

                              <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-bold text-subtle">
                                  Waktu Tiba
                                </span>
                                <input
                                  type="datetime-local"
                                  required
                                  disabled={hasBookings}
                                  value={seg.arrival_time}
                                  onChange={(e) =>
                                    updateSegment(idx, { arrival_time: e.target.value })
                                  }
                                  className="w-full h-10 px-2.5 bg-panel border border-line rounded-control text-ink text-xs font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-fg/30 disabled:opacity-70"
                                />
                              </div>

                              <div className="bg-panel border border-line p-2 rounded-control flex flex-col justify-center">
                                <span className="text-[10px] font-bold text-subtle uppercase">
                                  Durasi Terbang
                                </span>
                                <span className="text-xs font-bold text-brand-fg flex items-center gap-1 mt-0.5">
                                  <span className="material-symbols-outlined text-[14px]">
                                    schedule
                                  </span>
                                  <span>{flightDuration}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  )
                })}

                {/* Add Segment Button */}
                {flightType === 'transit' && !hasBookings && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={addSegment}
                      className="w-full py-3 px-4 rounded-ticket bg-page hover:bg-tint border border-line text-ink font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px] text-brand-fg">
                        add_circle
                      </span>
                      <span>Tambah segmen lanjutan (transit berikutnya)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ─── LIVE SEARCH RESULT PREVIEW CARD (Stitch B16 Specification) ─── */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-subtle uppercase tracking-wider">
                  Pratinjau tampilan bagi calon penumpang di hasil pencarian
                </span>
                <span className="text-[11px] font-bold text-brand-fg flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">visibility</span>
                  <span>Live Preview</span>
                </span>
              </div>

              {/* Customer Departure Board Card */}
              <div className="bg-panel border border-line rounded-ticket p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* Airline & Flight Number */}
                  <div className="flex items-center gap-3.5 min-w-[170px]">
                    <div className="w-10 h-10 rounded-control bg-tint text-brand-fg flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[22px]">flight_takeoff</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-ink text-sm leading-snug">
                        {currentAirline?.name || 'Kenari Air'}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-subtle mt-0.5">
                        <span className="font-semibold text-ink">
                          {flightNumber || 'KA 220'}
                        </span>
                        <span>•</span>
                        <span>{currentAirplane?.model || 'Boeing 737'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Flight Journey Flow */}
                  <div className="flex items-center gap-4 flex-1 max-w-md">
                    <div className="text-right">
                      <span className="font-bold tabular-nums text-ink text-base">
                        {formatTimeOnly(segments[0]?.departure_time)}
                      </span>
                      <span className="text-xs text-subtle block font-semibold">
                        {getAirport(segments[0]?.origin_airport_id)?.code || 'CGK'}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-[11px] font-medium text-subtle mb-1">
                        Total {totalJourneyDuration}
                      </span>
                      <div className="relative w-full flex items-center justify-center">
                        <div className="w-full h-0.5 bg-line" />
                        {flightType === 'transit' && (
                          <div className="absolute w-2.5 h-2.5 rounded-full bg-brand ring-4 ring-panel" />
                        )}
                        <span className="material-symbols-outlined absolute text-brand-fg text-xs -top-3.5">
                          flight
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold bg-tint text-brand-fg px-2 py-0.5 rounded-full mt-1.5">
                        {flightType === 'transit'
                          ? `${segments.length - 1} transit di ${
                              getAirport(segments[0]?.destination_airport_id)?.code || 'SUB'
                            }`
                          : 'Penerbangan Langsung'}
                      </span>
                    </div>

                    <div className="text-left">
                      <span className="font-bold tabular-nums text-ink text-base">
                        {formatTimeOnly(segments[segments.length - 1]?.arrival_time)}
                      </span>
                      <span className="text-xs text-subtle block font-semibold">
                        {getAirport(segments[segments.length - 1]?.destination_airport_id)?.code ||
                          'DPS'}
                      </span>
                    </div>
                  </div>

                  {/* Price & Choose CTA */}
                  <div className="flex items-center justify-between lg:justify-end gap-5 pt-3 lg:pt-0 lg:border-l lg:border-line lg:pl-5">
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] font-bold text-subtle uppercase">
                        Mulai Dari
                      </span>
                      <div className="text-base font-bold text-brand-fg tabular-nums">
                        Rp {Number(priceEconomy || 0).toLocaleString('id-ID')}
                        <span className="text-[10px] text-subtle font-normal"> /org</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="h-9 px-4 rounded-control bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-xs transition-colors"
                    >
                      Pilih
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ════ STICKY ACTION FOOTER BAR ════ */}
          <aside className="fixed bottom-0 left-0 lg:left-60 right-0 h-20 bg-panel/95 backdrop-blur-md border-t border-line shadow-lg z-40 px-6 lg:px-8 flex items-center justify-between">
            <div className="max-w-[1360px] w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Left: Auto Generation Capacity Note */}
              <div className="flex items-center gap-2 text-subtle text-xs">
                <span className="material-symbols-outlined text-[18px] text-brand-fg">info</span>
                <span>
                  Kursi kabin dibuat otomatis sesuai konfigurasi pesawat (
                  <strong className="text-ink font-semibold">
                    {totalSeats} total kursi:{' '}
                    {currentAirplane?.totalSeatEconomy || 180} Ekonomi,{' '}
                    {currentAirplane?.totalSeatBusiness || 0} Bisnis
                  </strong>
                  ).
                </span>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate('/admin/flights')}
                  disabled={submitting}
                  className="h-11 px-5 rounded-control border border-line text-ink hover:bg-page font-medium text-sm transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-11 px-6 rounded-control bg-brand hover:bg-brand-hover text-white font-semibold text-sm shadow-md transition-all flex items-center gap-2 active:scale-95"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan jadwal...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      <span>Simpan jadwal penerbangan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </aside>
        </form>

        {/* Success Toast */}
        {successToast && (
          <aside className="fixed bottom-24 right-8 z-50 bg-raised border border-line text-ink px-4 py-3.5 rounded-ticket shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200">
            <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-ink">Berhasil</span>
              <span className="text-xs text-subtle">{successToast}</span>
            </div>
          </aside>
        )}
      </div>
    </AdminLayout>
  )
}
