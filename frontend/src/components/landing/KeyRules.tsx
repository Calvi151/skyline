export default function KeyRules() {
  const leftRules = [
    {
      icon: 'timer',
      title: 'Batas pembayaran',
      description:
        'Waktu pembayaran berlaku 1 jam setelah reservasi dibuat. Tiket dilepas otomatis ke sistem jika melewati tenggat.',
    },
    {
      icon: 'flight_takeoff',
      title: 'Check-in online',
      description:
        'Check-in online dibuka 24 jam sebelum jadwal keberangkatan langsung melalui portal web tanpa perlu antre di bandara.',
    },
    {
      icon: 'currency_exchange',
      title: 'Kebijakan refund',
      description:
        'Permohonan pengembalian dana dapat diajukan mandiri hingga batas 6 jam sebelum jadwal lepas landas sesuai kelas tiket.',
    },
  ]

  const rightRules = [
    {
      icon: 'luggage',
      title: 'Bagasi tambahan',
      description:
        'Pilih bagasi tambahan saat reservasi awal untuk menikmati tarif lebih hemat hingga 35% dibandingkan biaya di bandara.',
    },
    {
      icon: 'picture_as_pdf',
      title: 'E-tiket instan',
      description:
        'E-tiket PDF resmi otomatis dikirimkan ke email dan akun terdaftar seketika setelah pembayaran terverifikasi.',
    },
    {
      icon: 'badge',
      title: 'Identitas penumpang',
      description:
        'Pastikan nama lengkap, nomor NIK/KTP, atau paspor sesuai dengan kartu identitas sah saat verifikasi di bandara.',
    },
  ]

  return (
    <section className="w-full py-10 md:py-16 text-left border-b border-line">
      <div className="mb-8">
        <span className="text-[11px] uppercase tracking-wider text-brand-fg font-bold block mb-1">
          Regulasi Operasional
        </span>
        <h2 className="text-2xl md:text-3xl font-bold text-ink tracking-tight font-sans">
          Aturan yang perlu kamu tahu
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        {/* Left Column */}
        <div className="space-y-4">
          {leftRules.map((r) => (
            <div
              key={r.title}
              className="group p-4 bg-panel rounded-control border border-line hover:border-brand-fg/50 hover:-translate-y-1 hover:shadow-md transition-all duration-300"
            >
              <div className="flex items-center gap-2.5 text-ink font-bold text-base font-sans">
                <span className="material-symbols-outlined text-brand-fg text-[20px] select-none group-hover:scale-110 transition-transform duration-200">
                  {r.icon}
                </span>
                <span>{r.title}</span>
              </div>
              <p className="text-xs md:text-sm text-subtle mt-1.5 pl-7 font-sans leading-relaxed">
                {r.description}
              </p>
            </div>
          ))}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {rightRules.map((r) => (
            <div
              key={r.title}
              className="group p-4 bg-panel rounded-control border border-line hover:border-brand-fg/50 hover:-translate-y-1 hover:shadow-md transition-all duration-300"
            >
              <div className="flex items-center gap-2.5 text-ink font-bold text-base font-sans">
                <span className="material-symbols-outlined text-brand-fg text-[20px] select-none group-hover:scale-110 transition-transform duration-200">
                  {r.icon}
                </span>
                <span>{r.title}</span>
              </div>
              <p className="text-xs md:text-sm text-subtle mt-1.5 pl-7 font-sans leading-relaxed">
                {r.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
