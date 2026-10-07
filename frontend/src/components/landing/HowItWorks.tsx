import { useState } from 'react'

interface Step {
  number: number
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    number: 1,
    title: 'Cari penerbangan',
    description: 'Tentukan rute, tanggal perjalanan, dan jumlah penumpang sesuai rencana.',
  },
  {
    number: 2,
    title: 'Pilih kursi & bagasi',
    description: 'Lihat peta kabin interaktif, pilih nomor kursi favorit, dan sesuaikan kuota bagasi.',
  },
  {
    number: 3,
    title: 'Bayar lewat Midtrans',
    description: 'Transaksi aman instan via QRIS, Virtual Account bank nasional, atau kartu kredit.',
  },
  {
    number: 4,
    title: 'Check-in online & terbang',
    description: 'Akses tiket digital 24 jam sebelum keberangkatan tanpa antre di konter fisik.',
  },
]

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState<number>(2)

  return (
    <section className="w-full py-10 md:py-16 border-t border-line text-left">
      <div className="mb-8">
        <span className="text-[11px] uppercase tracking-wider text-brand-fg font-bold block mb-1">
          Langkah Sederhana
        </span>
        <h2 className="text-2xl md:text-3xl font-bold text-ink tracking-tight font-sans">
          Alur pemesanan transparan
        </h2>
      </div>

      <div className="relative w-full">
        {/* Horizontal Connecting Line on desktop */}
        <div className="hidden md:block absolute top-4 left-10 right-10 h-0.5 bg-line -z-0">
          <div
            className="h-full bg-brand-fg transition-all duration-500 ease-out"
            style={{ width: `${((activeStep - 1) / (STEPS.length - 1)) * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8 relative z-10">
          {STEPS.map((step) => {
            const isCompleted = step.number < activeStep
            const isActive = step.number === activeStep

            return (
              <div
                key={step.number}
                onMouseEnter={() => setActiveStep(step.number)}
                className="flex md:flex-col items-start gap-4 group cursor-pointer p-2 rounded-xl transition-all duration-300 hover:-translate-y-1 hover:bg-tint/30"
              >
                {/* Step indicator node */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-all select-none ${
                    isCompleted
                      ? 'bg-brand text-white shadow-sm ring-4 ring-page'
                      : isActive
                      ? 'bg-brand text-white shadow-md ring-4 ring-brand/20 scale-105'
                      : 'bg-panel border-2 border-line text-subtle group-hover:border-brand-fg group-hover:text-ink'
                  }`}
                >
                  {isCompleted ? (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  ) : (
                    step.number
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider ${
                        isActive ? 'text-brand-fg' : 'text-subtle'
                      }`}
                    >
                      {isActive ? 'Sedang Aktif' : `Langkah 0${step.number}`}
                    </span>
                  </div>
                  <h3
                    className={`text-base font-bold mt-0.5 font-sans transition-colors ${
                      isActive ? 'text-brand-fg' : 'text-ink group-hover:text-brand-fg'
                    }`}
                  >
                    {step.title}
                  </h3>
                  <p className="text-xs md:text-sm text-subtle mt-1 font-sans leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
