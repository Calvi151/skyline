import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="w-full bg-chrome text-on-chrome border-t border-on-chrome/10">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-12 md:py-16 text-left">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          {/* Col 1: Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-on-chrome">
              <span className="material-symbols-outlined text-tint text-[28px] select-none">
                flight_takeoff
              </span>
              <span className="font-sans">
                Sky<span className="text-tint">Book</span>
              </span>
            </div>
            <p className="text-xs md:text-sm text-on-chrome/70 max-w-xs font-sans leading-relaxed">
              Platform reservasi dan layanan aviasi cerdas untuk kenyamanan penerbangan
              lintas kepulauan nusantara.
            </p>
          </div>

          {/* Col 2: Layanan */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-tint font-bold mb-4 font-sans">
              Layanan
            </h3>
            <ul className="space-y-2.5 text-xs md:text-sm">
              <li>
                <Link
                  to="/"
                  className="text-on-chrome/80 hover:text-on-chrome transition-colors"
                >
                  Pencarian Tiket
                </Link>
              </li>
              <li>
                <Link
                  to="/check-in"
                  className="text-on-chrome/80 hover:text-on-chrome transition-colors"
                >
                  Check-in Online
                </Link>
              </li>
              <li>
                <Link
                  to="/schedules"
                  className="text-on-chrome/80 hover:text-on-chrome transition-colors"
                >
                  Jadwal Penerbangan
                </Link>
              </li>
              <li>
                <Link
                  to="/refund"
                  className="text-on-chrome/80 hover:text-on-chrome transition-colors"
                >
                  Pengajuan Refund
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Bantuan */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-tint font-bold mb-4 font-sans">
              Bantuan
            </h3>
            <ul className="space-y-2.5 text-xs md:text-sm">
              <li>
                <a
                  href="#faq"
                  className="text-on-chrome/80 hover:text-on-chrome transition-colors"
                >
                  Pusat Bantuan & FAQ
                </a>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="text-on-chrome/80 hover:text-on-chrome transition-colors"
                >
                  Syarat & Ketentuan
                </Link>
              </li>
              <li>
                <Link
                  to="/status"
                  className="text-on-chrome/80 hover:text-on-chrome transition-colors"
                >
                  Status Penerbangan
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-on-chrome/80 hover:text-on-chrome transition-colors"
                >
                  Kontak Kami
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Kebijakan */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-tint font-bold mb-4 font-sans">
              Syarat & Kebijakan
            </h3>
            <ul className="space-y-2.5 text-xs md:text-sm">
              <li>
                <Link
                  to="/privacy"
                  className="text-on-chrome/80 hover:text-on-chrome transition-colors"
                >
                  Kebijakan Privasi
                </Link>
              </li>
              <li>
                <Link
                  to="/ticket-policy"
                  className="text-on-chrome/80 hover:text-on-chrome transition-colors"
                >
                  Kebijakan Tiket
                </Link>
              </li>
              <li>
                <Link
                  to="/baggage-policy"
                  className="text-on-chrome/80 hover:text-on-chrome transition-colors"
                >
                  Regulasi Bagasi
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-on-chrome/10 flex flex-col md:flex-row items-center justify-between text-on-chrome/60 text-xs gap-3">
          <div>© 2026 SkyBook Indonesia. Seluruh hak cipta dilindungi.</div>
          <div className="flex items-center gap-4 text-[11px] font-mono tracking-wider">
            <span>IDN / IDR</span>
            <span>•</span>
            <span>AVIATION LOGISTICS GRADE</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
