export interface FAQItem {
  id: string
  question: string
  answer: string
}

export const faqList: FAQItem[] = [
  {
    id: 'checkin',
    question: 'Kapan check-in online bisa dilakukan?',
    answer:
      'Check-in online dibuka 24 jam sebelum keberangkatan dan ditutup 1 jam sebelum jadwal lepas landas. Anda dapat memilih kembali kursi yang tersedia dan mengunduh boarding pass digital dalam format PDF berstandar IATA.',
  },
  {
    id: 'refund',
    question: 'Bagaimana cara membatalkan dan mengajukan refund?',
    answer:
      'Permohonan pengembalian dana dapat diajukan mandiri melalui menu Pesanan Saya hingga batas 6 jam sebelum jadwal keberangkatan, sesuai ketentuan kelas tiket dan kebijakan maskapai.',
  },
  {
    id: 'payment',
    question: 'Metode pembayaran apa saja yang didukung?',
    answer:
      'Kami mendukung pembayaran instan terverifikasi otomatis melalui Midtrans, mencakup QRIS (GoPay, OVO, Dana), Virtual Account BCA, Mandiri, BNI, BRI, serta Kartu Kredit/Debit berlogo Visa dan Mastercard.',
  },
  {
    id: 'baggage',
    question: 'Apakah bagasi kabin sudah termasuk dalam tiket?',
    answer:
      'Setiap tiket mencakup bagasi kabin gratis hingga 7 kg. Untuk bagasi tercatat (checked baggage), Anda dapat memesan kuota tambahan saat reservasi awal dengan tarif hemat hingga 35%.',
  },
  {
    id: 'delay',
    question: 'Bagaimana jika penerbangan mengalami keterlambatan?',
    answer:
      'Notifikasi keterlambatan akan dikirimkan otomatis melalui email dan WhatsApp terdaftar. Hak kompensasi mengacu pada Peraturan Menteri Perhubungan Republik Indonesia (PM 89/2015).',
  },
  {
    id: 'boarding-pass',
    question: 'Apakah saya perlu mencetak boarding pass fisik?',
    answer:
      'Tidak wajib. Boarding pass digital di ponsel dengan barcode yang jelas dapat langsung dipindai pada gerbang keamanan dan boarding gate di seluruh bandara di Indonesia.',
  },
]
