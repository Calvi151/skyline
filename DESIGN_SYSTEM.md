# Design System - SkyBook

Prompt visual untuk membuat desain di Stitch ada di `STITCH_PROMPT.md` (bagian A). Dokumen ini versi untuk developer dan AI coding agent, dan menjadi sumber kebenaran token: jika berbeda dengan hasil Stitch, dokumen ini yang dipakai.
SkyBook adalah **aplikasi web** (desktop-first, kanvas 1440px) dengan landing page publik, area customer, admin, dan staff.

## Arah Desain: "sky and horizon"
Interior kabin premium yang tenang bertemu biru langit di atas kepulauan Indonesia. Tenang, presisi, editorial.
Elemen paling diingat: kode bandara berukuran besar (CGK, DPS, SUB) dan garis rute tipis antar kota.
Semua elemen lain dibuat diam dan disiplin.
Tema terang = langit pagi di atas kepulauan. Tema gelap = langit malam: biru tengah malam dengan garis rute yang menyala lembut.

## Tema: terang dan gelap
Dua tema, **terang** (default) dan **gelap**. Komponen memakai token semantik (CSS variables), bukan hex mentah, sehingga satu kelas `dark` pada `<html>` mengganti seluruh tampilan. Layout, komponen, ikon, dan state interaksi sama di kedua tema; hanya warna dan kedalaman yang berubah.

| Token | Peran | Terang | Gelap |
|---|---|---|---|
| page | background halaman | #EAF1F8 | #0A1626 |
| panel | tiket, panel, input | #FAFCFF | #112038 |
| raised | layer melayang: dropdown, tooltip, dialog, toast, boarding pass hero | #FAFCFF | #172B4D |
| ink | teks utama, outline tombol sekunder | #0B2545 | #E8F0FA |
| subtle | teks sekunder, ikon | #54677F | #8FA3BD |
| line | border dan pemisah | #CBD8E6 | #243A5C |
| tint | hover dan baris terpilih | #DCE8F8 | #1A305A |
| chrome | sidebar admin, footer, band "Kursi pilihan sendiri" di landing | #0B2545 | #060E1A |
| on-chrome | teks di atas chrome dan brand-panel | #FAFCFF | #E8F0FA |
| brand | fill tombol utama (teks putih) | #1D5BD6 | #1D5BD6 |
| brand-hover | hover dan pressed tombol utama | #1647A8 | #3469E0 |
| brand-fg | biru sebagai foreground: tautan, focus ring, garis rute, garis chart, progress bar, garis bawah tab aktif | #1D5BD6 | #7BA9FF |
| brand-panel | panel brand penuh tinggi di Login dan Daftar | #1D5BD6 | #060E1A |
| signal | aksen tanda tangan. HANYA kursi terpilih dan bar menu admin aktif | #E8532F | #FF6A45 |
| on-signal | ikon centang di atas signal | #FFFFFF | #0A1626 |
| success | paid, checked in, boarded | #2F7D57 | #4CC38A |
| danger | error, cancelled, rejected | #B01E3C | #FF6B85 |
| sky-end | ujung bawah sky wash hero landing (dari page ke sky-end) | #DCE8F8 | #12294D |

Aturan:
- Tanpa emas/kuning, ungu, teal, krem/beige, dan tanpa biru atau oranye lain di luar token di atas. Tanpa gradient kecuali satu sky wash di hero landing (page ke sky-end, atas ke bawah). Tanpa glassmorphism, glow.
- Tema terang: area konten terang (page dan panel). Chrome muncul untuk sidebar admin, footer, dan band landing. Brand membawa identitas, tetapi halaman tidak boleh terasa seperti blok biru penuh.
- Tema gelap: tanpa hitam murni dan putih murni. Panel dipisah border line, bukan shadow. Layer melayang memakai raised, border line, dan shadow hitam 40% blur 24px (tema terang: ink 8% blur 24px).
- Status pending memakai outline putus-putus ink (bukan warna aksen).
- Kontras terang: teks putih di atas brand sekitar 6:1, ink di atas panel sangat tinggi, subtle di atas panel sekitar 5,6:1. Signal dipakai pada elemen grafis (kursi, bar) sekitar 3,7:1 dengan centang putih, tidak untuk teks.
- Kontras gelap: ink di atas page lebih dari 14:1, subtle di atas page sekitar 7:1 dan di atas panel sekitar 6,3:1, brand-fg di atas page sekitar 7,8:1, signal dengan centang on-signal sekitar 6,4:1, danger di atas panel sekitar 6:1, teks putih di atas brand sekitar 6:1 dan di atas brand-hover sekitar 5:1.

### Memilih tema
- Default mengikuti `prefers-color-scheme`. Pilihan manual (light, dark, system) disimpan di localStorage key `theme`.
- Skrip kecil inline di `index.html` menambah kelas `dark` sebelum render agar tidak berkedip.
- ThemeToggle (ikon matahari dan bulan, 40px) ada di navbar dan topbar admin.
- Tombol Google memakai tema `outline` di terang dan `filled_black` di gelap.

### CSS variables (src/index.css)
Nilai berupa triplet RGB agar mendukung opacity Tailwind.
```css
:root {
  --page: 234 241 248; --panel: 250 252 255; --raised: 250 252 255;
  --ink: 11 37 69; --subtle: 84 103 127; --line: 203 216 230; --tint: 220 232 248;
  --chrome: 11 37 69; --on-chrome: 250 252 255;
  --brand: 29 91 214; --brand-hover: 22 71 168; --brand-fg: 29 91 214; --brand-panel: 29 91 214;
  --signal: 232 83 47; --on-signal: 255 255 255;
  --success: 47 125 87; --danger: 176 30 60; --sky-end: 220 232 248;
}
.dark {
  --page: 10 22 38; --panel: 17 32 56; --raised: 23 43 77;
  --ink: 232 240 250; --subtle: 143 163 189; --line: 36 58 92; --tint: 26 48 90;
  --chrome: 6 14 26; --on-chrome: 232 240 250;
  --brand: 29 91 214; --brand-hover: 52 105 224; --brand-fg: 123 169 255; --brand-panel: 6 14 26;
  --signal: 255 106 69; --on-signal: 10 22 38;
  --success: 76 195 138; --danger: 255 107 133; --sky-end: 18 41 77;
}
```

### Tailwind config
Nama token sengaja tidak memakai nama bawaan shadcn/ui (primary, secondary, muted, accent, destructive, border, ring) agar tidak bentrok. Di `components/ui`, petakan class shadcn ke token di atas.
```ts
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        page: token('page'), panel: token('panel'), raised: token('raised'),
        ink: token('ink'), subtle: token('subtle'), line: token('line'), tint: token('tint'),
        chrome: token('chrome'), 'on-chrome': token('on-chrome'),
        brand: token('brand'), 'brand-hover': token('brand-hover'),
        'brand-fg': token('brand-fg'), 'brand-panel': token('brand-panel'),
        signal: token('signal'), 'on-signal': token('on-signal'),
        success: token('success'), danger: token('danger'), 'sky-end': token('sky-end'),
      },
      borderRadius: { control: '8px', ticket: '16px' },
      fontFamily: { sans: ['"Schibsted Grotesk"', '"Hanken Grotesk"', 'system-ui', 'sans-serif'] },
      maxWidth: { content: '1200px' },
    },
  },
}
```

## Typography
- Satu keluarga: Schibsted Grotesk (fallback Hanken Grotesk).
- Display (kode bandara, judul, headline hero): weight 600, ukuran besar, letter-spacing -0.02em.
- Body: weight 400, 16px, line-height 1.5, panjang baris maksimal 70 karakter.
- Waktu, harga, kode: `tabular-nums`.
- Sentence case. Tanpa label huruf kapital semua, tanpa eyebrow di atas heading, tanpa menyorot satu kata di headline.
- Teks rata kiri.

## Format Data
- Mata uang `Rp 1.286.000`, waktu `07.40`, durasi `2j 50m`, tanggal `Sel, 14 Okt 2026`.

## Layout Web
- Grid 12 kolom, lebar konten 1200px, jarak antar section landing 96px, di dalam halaman aplikasi 32px.
- Navbar 72px: wordmark kiri, link tengah/kiri, Masuk dan Daftar di kanan (menu avatar jika login).
- Alur booking: dua kolom, konten kiri dan panel ringkasan harga sticky di kanan (360px).
- Responsif: di bawah 1024px sidebar filter menjadi drawer, panel sticky turun di bawah konten; di bawah 768px satu kolom.

| Area | Layout |
|---|---|
| Landing dan Customer | PublicLayout / CustomerLayout: navbar (dengan ThemeToggle) + konten + footer chrome |
| Auth | AuthLayout terbelah 50/50: kiri BrandPanel penuh tinggi (fill brand-panel) berisi peta rute, boarding pass mengambang, dan seat map mini; kanan panel form 440px di atas page, ThemeToggle di kanan atas. Di bawah 1024px BrandPanel disembunyikan |
| Admin | sidebar chrome 240px (item aktif punya bar signal tipis di kiri) + topbar (ThemeToggle, nama user, Keluar) + konten di atas page |
| Staff | topbar saja + konten |

## Shape dan Kedalaman
- Dua radius: `rounded-control` 8px (input, tombol, chip) dan `rounded-ticket` 16px (panel tiket). Chip status fully rounded.
- Pemisah memakai border 1px line dan whitespace. Layer melayang (dropdown, date picker, tooltip, dialog, toast, boarding pass mengambang di hero) memakai raised dan satu shadow lembut (terang: ink 8%; gelap: hitam 40% plus border line), blur 24px. Elemen lain tanpa shadow.
- Daftar memakai baris bergaris tipis, bukan grid kartu identik. Kartu hanya untuk tiket dan boarding pass.

## Komponen Dasar (shadcn/ui di-style ulang)
| Komponen | Spesifikasi |
|---|---|
| Button primary | fill brand, teks putih, 48px, radius 8px, hover dan pressed brand-hover, label kata kerja, tanpa glyph panah |
| Button secondary | outline ink 1px, tanpa fill |
| Link | brand-fg dengan underline |
| Input | fill panel, border line, 52px, label di atas, ikon outline di kiri, fokus ring 2px brand-fg, centang success saat valid |
| Tabs | garis bawah brand-fg untuk tab aktif, bukan pill |
| Table | baris bergaris tipis, angka tabular, tanpa zebra |
| Accordion | untuk FAQ, pemisah line |
| Tombol Google | outline ink (tema gelap: filled_black), logo Google resmi, label "Lanjutkan dengan Google". Logo Google adalah satu-satunya elemen multiwarna yang diizinkan |
| Dialog | konfirmasi aksi dengan kalimat spesifik |
| Toast (Sonner) | kata kerja sama dengan tombol ("Disimpan") |

## Komponen Khusus SkyBook
| Komponen | Fungsi |
|---|---|
| AirportCode | kode bandara besar + nama kota |
| RouteLine | dua waktu, garis tipis brand-fg, titik per transit, durasi di atas garis |
| RouteMap | peta rute abstrak kepulauan (SVG garis tipis + titik kota) untuk hero landing |
| TicketPanel | panel 16px dengan notch dan perforasi putus-putus (horizontal atau vertikal) |
| SearchPanel | form pencarian bergaya boarding pass, horizontal |
| StatusChip | ikon + teks |
| GoogleSignInButton | komponen resmi Google (ID token), tema outline, lebar penuh panel |
| EmailVerificationBanner | bar tipis di bawah navbar (panel, border bawah line, ikon surat ink, teks, tombol teks "Kirim ulang email"). Tanpa warna alert karena bukan error |
| PopularRoutes | daftar rute bergaya papan keberangkatan |
| SeatMap | kabin 3-3 dengan lorong, nomor baris, penanda pintu darurat |
| PriceSummary | panel ringkasan harga sticky |
| EmptyState / ErrorState | jelaskan apa yang terjadi dan langkah berikutnya |
| ThemeToggle | tombol ikon matahari dan bulan (light, dark, system), di navbar dan topbar admin |
| BrandPanel | panel penuh tinggi di Login dan Daftar: RouteMap, FloatingPass, tiga baris keunggulan (Login) atau seat map mini (Daftar) |
| FloatingPass | mini boarding pass miring 3 derajat, raised dengan shadow, menumpuk di tepi peta atau panel |
| SeatShowcase | seat map mini interaktif (baris 14-16, pilih maks 2, tooltip, harga tambahan) di band landing |
| PasswordChecklist | tiga aturan kata sandi live dengan ikon dan strength bar 3 segmen |

### Status Chip
| Status | Tampilan |
|---|---|
| pending | outline putus-putus ink + ikon jam |
| paid, checked_in, boarded | tint success + ikon centang |
| cancelled, rejected, no_show | tint danger + ikon silang |
| refunded | tint subtle |
| direct, transit | teks netral, bukan chip warna |

### Seat Map
| Kondisi | Tampilan |
|---|---|
| Tersedia | panel dengan outline line |
| Terisi | fill line dengan tanda silang kecil |
| Dipilih | fill signal dengan centang on-signal |
| Dekat pintu darurat | label teks "Dekat pintu darurat" |
Legend di bawah seat map. Status tidak mengandalkan warna saja.

## Struktur Landing Page
1. Navbar (dengan ThemeToggle)
2. Hero di atas sky wash: headline rata kiri + RouteMap (pesawat kecil, FloatingPass) di kanan + SearchPanel horizontal dengan autocomplete bandara
3. Rute populer (baris bergaris tipis, bukan kartu; hover baris menebalkan rute di peta hero)
4. Cara kerja (4 langkah bernomor, karena memang urutan)
5. Kursi pilihan sendiri (band chrome + SeatShowcase di panel melayang)
6. Aturan penting (baris definisi)
7. FAQ (accordion)
8. Footer chrome
Tanpa testimoni, logo partner, grid fitur 3 kolom, banner promo, atau foto stok.

## Interaksi dan Motion
Halaman tidak boleh terasa statis. Semua elemen klik punya state yang terlihat:
| State | Tampilan |
|---|---|
| Hover baris | latar tint, garis rute jadi brand-fg, tautan bergaris bawah |
| Hover/pressed tombol utama | brand-hover |
| Focus | ring 2px brand-fg |
| Disabled | fill line, teks subtle |

- Kontrol dengan state nyata: segmented control, toggle, range slider dengan histogram harga, tab, chip filter yang bisa dihapus, baris radio yang bisa terbuka, accordion, stepper.
- Umpan balik: step bar di alur booking, centang inline setelah simpan, toast (tombol teks "Urungkan" hanya untuk aksi yang bisa dibatalkan), skeleton saat memuat, penghitung langsung (jumlah hasil, total harga saat kursi dipilih).
- Layer melayang (autocomplete bandara, date picker, tooltip kursi, menu baris) memakai shadow lembut dan muncul fade dengan naik 4px.
- Durasi: transisi hover 150ms ease-out, popover 150-200ms. Garis rute tergambar sekali saat halaman dimuat. Kursi terpilih: centang muncul singkat.
- Tanpa animasi berulang atau dekoratif. Hormati `prefers-reduced-motion`.

## Aturan Konten
- UI Bahasa Indonesia, kalimat biasa, kata kerja aktif.
- Tombol menyebut aksi persis ("Simpan kursi", "Selesaikan check-in"), bukan "Submit".
- Nama aksi konsisten di seluruh alur ("Simpan" menghasilkan toast "Disimpan").
- Error menjelaskan apa yang salah dan cara memperbaikinya, tanpa minta maaf.
- Data placeholder realistis: rute Indonesia, maskapai fiktif (Kenari Air, Halmahera Air), kode booking 6 karakter seperti K7QM4X.

## Aksesibilitas
- Fokus keyboard selalu terlihat (ring 2px brand-fg).
- Kontras memenuhi WCAG AA. Target klik minimal 44px.
- Status selalu ikon + teks.
