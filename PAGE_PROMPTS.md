# PAGE_PROMPTS.md - Prompt per Halaman SkyBook (untuk AI Coding Agent)

Prompt implementasi frontend untuk **setiap halaman** (web), siap dipakai di Cursor / Claude Code / Windsurf setelah desain dari Stitch selesai.
Prompt desain untuk Stitch ada di `STITCH_PROMPT.md` (nomor B1 sampai B21, plus B3a dan B3b untuk cek email dan verifikasi, sama urutannya dengan halaman di bawah). File itu hanya dipakai untuk membuat desain di Stitch; agent tidak wajib membacanya.

**Catatan revisi data real:** desain tidak berubah. Penyesuaian per halaman di bawah hanya berupa teks, ikon, dan satu opsi sort memakai komponen dan token yang sudah ada, ditandai "Revisi data real". Prompt backend untuk provider, job, dan notifikasi ada di bagian akhir (Prompt P).

## Cara pakai
1. Jalankan **Prompt 0 (Foundation)** dulu, sekali saja.
2. Jalankan prompt halaman satu per satu: Landing, Auth, Customer, Admin, lalu Staff.
3. Untuk tiap halaman, ambil referensi visual dari Stitch. Jika Stitch MCP terhubung, minta agent mengambil layar yang sesuai langsung dari proyek Stitch (ikuti tata letak, urutan, dan isi layar). Jika belum terhubung, lampirkan screenshot atau export dari Stitch.
4. Awali setiap prompt dengan: `Baca docs/PRD.md, docs/API_SPEC.md, docs/DESIGN_SYSTEM.md sebelum mulai.`
5. Pembagian sumber kebenaran: Stitch (lewat MCP atau screenshot) untuk tata letak dan komposisi visual; `DESIGN_SYSTEM.md` untuk token warna, tema terang dan gelap, dan komponen. Jika hasil Stitch berbeda soal warna (hex atau nama), ikuti `DESIGN_SYSTEM.md` dan jangan menimpa token. Tampilan gelap dibuat dari token tema, bukan disalin dari screenshot.

## Prinsip umum (berlaku untuk semua halaman)
- Aplikasi web, desktop-first (kanvas 1440px, konten 1200px), responsif ke tablet dan mobile dengan breakpoint Tailwind.
- Semua teks UI Bahasa Indonesia, sentence case, tombol memakai kata kerja spesifik.
- Setiap halaman wajib punya state: loading (skeleton), kosong (EmptyState), error (ErrorState dengan langkah perbaikan).
- Status penerbangan tertunda atau dibatalkan tidak membuat chip baru: tertunda ditampilkan sebagai teks `danger` + ikon jam ("Tertunda 25 menit"), dibatalkan memakai gaya chip `cancelled` yang sudah ada. Status tidak boleh bergantung pada warna saja.
- Ikuti token di DESIGN_SYSTEM.md. Pakai token semantik (page, panel, ink, brand-fg, dan seterusnya), bukan hex mentah, dan jangan menambah warna. Ada dua tema (terang dan gelap, kelas `dark` pada <html>); setiap komponen harus tampil benar di keduanya. Tanpa emas/kuning, ungu, krem. Gradient hanya sky wash di hero landing.

---

# Prompt 0 - Foundation (jalankan sekali)

```
Baca docs/PRD.md, docs/API_SPEC.md, docs/PROJECT_STRUCTURE.md, docs/DESIGN_SYSTEM.md. Referensi visual layar: Stitch MCP atau screenshot (lihat Cara pakai).

Siapkan fondasi frontend web (React 18 + Vite + TypeScript + Tailwind + shadcn/ui + Zustand + TanStack Query + React Router):

1. Tema terang dan gelap lewat CSS variables, persis seperti tabel dan snippet di DESIGN_SYSTEM.md (bagian Tema):
   - Definisikan variabel RGB di :root (terang) dan .dark (gelap) pada src/index.css; Tailwind `darkMode: 'class'`; petakan ke Tailwind dengan `rgb(var(--nama) / <alpha-value>)`.
   - Token semantik: page, panel, raised, ink, subtle, line, tint, chrome, on-chrome, brand, brand-hover, brand-fg, brand-panel, signal, on-signal, success, danger, sky-end. Jangan pakai hex mentah di komponen. Jangan memakai nama bawaan shadcn (primary, secondary, muted, accent, destructive, border, ring) untuk token ini; di components/ui petakan class shadcn ke token kita.
   - Aturan pakai: brand untuk fill tombol utama; brand-fg untuk tautan, focus ring, garis rute, chart, progress bar; signal hanya untuk kursi terpilih dan bar menu admin aktif (ikon centang memakai on-signal); chrome untuk sidebar admin, footer, band landing; brand-panel untuk panel brand Login/Daftar; tint untuk hover dan baris terpilih.
   - ThemeToggle (src/components/common/ThemeToggle.tsx) dan src/store/themeStore.ts: nilai light | dark | system disimpan di localStorage key `theme`, default mengikuti prefers-color-scheme. Skrip kecil inline di index.html menambah kelas `dark` sebelum render agar tidak berkedip. Tombol Google memakai theme `outline` di terang dan `filled_black` di gelap.
   Radius hanya dua: `rounded-control` (8px) dan `rounded-ticket` (16px).
   Font Schibsted Grotesk (fallback Hanken Grotesk), aktifkan `tabular-nums` untuk waktu dan harga.
   Container utama max-width 1200px.
2. Override style shadcn/ui (Button, Input, Select, Dialog, Tabs, Table, Accordion, Badge, Sonner) mengikuti token. Tanpa gradient (kecuali sky wash di hero landing). Shadow lembut hanya untuk layer melayang: dropdown, popover, tooltip, dialog, toast (terang: ink 8%, blur 24px; gelap: hitam 40% plus border line).
   Semua elemen klik punya state hover, pressed, focus (ring 2px brand-fg), dan disabled. Transisi hover 150ms ease-out, popover fade + naik 4px, hormati `prefers-reduced-motion`.
3. Komponen reusable di src/components/common:
   AirportCode, RouteLine, TicketPanel (notch + perforasi horizontal/vertikal), StatusChip, PriceText, TimeText, DurationText, EmptyState, ErrorState, PageSkeleton, ThemeToggle, FloatingPass (mini boarding pass miring 3 derajat, raised + shadow).
   Di src/components/auth: GoogleSignInButton (bungkus GoogleLogin dari @react-oauth/google), EmailVerificationBanner, BrandPanel (panel penuh tinggi: RouteMap, FloatingPass, tiga baris keunggulan atau seat map mini) dan PasswordChecklist.
   authStore menyimpan: user, role, emailVerified, hasPassword, hasGoogle.
4. Komponen layout di src/components/layout:
   - PublicLayout dan CustomerLayout: navbar 72px (wordmark, Cari tiket, Check-in online, Bantuan, ThemeToggle, Masuk/Daftar atau menu avatar) + Footer (latar chrome, teks on-chrome).
   - AuthLayout: layout terbelah 50/50. Kiri BrandPanel (fill brand-panel, penuh tinggi, disembunyikan di bawah 1024px), kanan panel form 440px di atas page dengan ThemeToggle di kanan atas.
   - AdminLayout: sidebar chrome 240px (item aktif punya bar tipis signal di kiri) + topbar (ThemeToggle, nama user, Keluar).
   - StaffLayout: topbar saja.
5. src/lib/api.ts: fetch wrapper dengan credentials: "include", parsing format { error, data }, error terstruktur { message, code }.
6. AppRouter + ProtectedRoute + RoleRoute (admin, staff, customer). Route publik: /, /login, /register, /verify-email, /search. Route login wajib: /check-email, /flights/:id, dan seterusnya.
7. Halaman showcase komponen di /dev/components.

Jangan membuat halaman produk dulu.
```

---

# PUBLIC

## B1. Landing page (`pages/customer/Landing.tsx`, route `/`)
```
Baca docs/API_SPEC.md (Public Reference Data, Flight Search) dan lampiran desain Landing dari Stitch.

Buat landing page publik di route /. Komponen section ditaruh di src/components/landing/.
1. Hero di atas sky wash (gradient page ke sky-end, satu-satunya gradient): headline "Pesan tiket, pilih kursi, check-in online." + satu kalimat penjelas, rata kiri. Di kanan, RouteMap (komponen SVG sendiri): peta rute abstrak kepulauan Indonesia dari garis tipis brand-fg dan titik kota (CGK, SUB, DPS, UPG, KNO, JOG) dengan kode bandara besar di sebelah titik, ikon pesawat kecil di rute CGK-DPS dengan jejak putus-putus (garis tergambar sekali saat dimuat), dan FloatingPass yang menumpuk di tepi kiri bawah peta. Hover baris PopularRoutes menebalkan rute yang sama di peta. Tanpa foto, tanpa globe.
2. SearchPanel horizontal bergaya boarding pass di bawah headline (lebar 1200px): Dari, Ke (tombol tukar), Tanggal berangkat, Penumpang (1-9), Kelas (Ekonomi/Bisnis), tombol utama "Cari penerbangan".
   - Pemilihan bandara: popover autocomplete dari GET /api/airports?q=. Setiap saran menampilkan kode (Display), kota, dan nama bandara; navigasi panah dan Enter; saran aktif disorot tint.
   - Validasi: asal dan tujuan beda, tanggal tidak lampau.
   - Submit navigasi ke /search?origin=CGK&destination=DPS&date=2026-10-14&passengers=1&class=economy.
3. PopularRoutes: daftar 6 baris bergaris tipis bergaya papan keberangkatan (rute dua kode besar, nama kota, jam tipikal, durasi, "mulai dari Rp ..." , link "Lihat jadwal"). Data dari GET /api/routes/popular. Klik baris mengisi form dan menggulir ke SearchPanel (atau langsung ke /search untuk tanggal terdekat).
4. HowItWorks: 4 langkah bernomor (ini urutan sungguhan) pada garis horizontal dengan titik. Garis dan titik terisi brand-fg sampai langkah yang sedang di-hover atau difokus.
5. SeatShowcase (src/components/landing/SeatShowcase.tsx): band chrome penuh lebar. Kiri: judul "Pilih kursi sendiri, harga langsung terlihat.", satu kalimat, tiga baris bergaris tipis berikon. Kanan: panel tiket melayang (raised, rounded-ticket) berisi seat map mini baris 14-16 (A-F, lorong) yang bisa diklik: pilih atau batal pilih (maks 2), tooltip saat hover dan fokus ("Kursi 15C, lorong, gratis"), kursi pintu darurat berlabel +Rp 90.000, total tambahan dihitung langsung. Data statis di src/content/seatShowcase.ts, tanpa panggilan API. Boarding pass ber-QR mengintip di belakang panel.
6. KeyRules: baris definisi dua kolom: Batas pembayaran 1 jam, Check-in dibuka 24 jam sebelum berangkat, Refund sampai 6 jam sebelum berangkat, Bagasi tambahan dipilih saat pesan, E-tiket bisa diunduh PDF.
7. FAQ: accordion 6 pertanyaan (konten statis di src/content/faq.ts), pertanyaan pertama terbuka.
8. Footer.
Tanpa testimoni, logo partner, grid fitur 3 kolom, atau banner promo. Motion untuk hover, accordion, popover, tooltip, toast, pilih kursi, dan garis rute yang tergambar sekali saat halaman dimuat. Tanpa animasi berulang.
State: PopularRoutes punya skeleton dan EmptyState ("Belum ada rute tersedia").
Acceptance: halaman terbaca baik di 1440px dan di bawah 768px, form bisa dioperasikan keyboard, query string benar, nilai pencarian terakhir disimpan di localStorage (5 item) dan tampil di bawah SearchPanel.
```

## B2. Login (`pages/auth/Login.tsx`)
```
Baca docs/API_SPEC.md (Auth) dan lampiran desain Login dari Stitch.

Route /login memakai AuthLayout. Dipakai semua role (customer, staff, admin).
- Layout terbelah: BrandPanel kiri (peta rute, FloatingPass, tiga baris keunggulan berikon: Pilih kursi sendiri, Check-in online 24 jam sebelum berangkat, E-tiket PDF langsung di akunmu), panel form kanan. Field berikon (mail, lock), ring fokus 2px brand-fg, centang success saat email valid, tombol mata tampil/sembunyi, tombol "Masuk" punya state loading (spinner, label "Memproses", disabled).
- Tombol Google di atas: komponen resmi `GoogleLogin` dari @react-oauth/google (tema outline, text "continue_with", locale "id", lebar penuh panel). onSuccess mengirim `credential` ke POST /api/auth/google. Muat provider dengan VITE_GOOGLE_CLIENT_ID.
- Pemisah "atau", lalu field email dan kata sandi (toggle tampil/sembunyi), tombol "Masuk", link "Belum punya akun? Daftar".
- Validasi zod + react-hook-form: email valid, kata sandi minimal 8 karakter.
- Setelah login (password atau Google) panggil GET /api/auth/me dan simpan ke authStore termasuk `emailVerified`.
- Redirect: admin ke /admin, staff ke /staff, customer ke ?redirect= atau /.
- Pesan error:
  - INVALID_CREDENTIALS: "Email atau kata sandi salah. Periksa lagi."
  - USE_GOOGLE_SIGNIN: "Akun ini terdaftar lewat Google. Masuk dengan tombol Google di atas."
  - ACCOUNT_DISABLED: "Akun dinonaktifkan. Hubungi admin."
  - GOOGLE_TOKEN_INVALID: "Masuk dengan Google gagal. Coba lagi."
  - GOOGLE_NOT_ALLOWED_FOR_ROLE: "Akun staf dan admin masuk dengan email dan kata sandi."
- Tombol loading + disabled saat submit. Jika sudah login, redirect otomatis.
Acceptance: tiga role mengarah ke tujuan benar, login Google membuat atau menautkan akun customer, cookie httpOnly terset, refresh tetap login.
```

## B3. Register (`pages/auth/Register.tsx`)
```
Baca docs/API_SPEC.md (Auth) dan lampiran desain Daftar dari Stitch.

Route /register (customer saja), AuthLayout.
- BrandPanel varian Daftar: headline "Pilih kursi sendiri sebelum terbang." dan seat map mini (dua kursi terpilih, tooltip di 15C) di panel melayang, boarding pass ber-QR mengintip di belakang.
- Field berikon (person, mail, lock). Nomor telepon dengan prefix +62.
- Tombol Google "Daftar dengan Google" (GoogleLogin, text="signup_with") memakai alur yang sama dengan Login; akun Google langsung terverifikasi sehingga redirect ke / (atau ?redirect=).
- Pemisah "atau", lalu field: nama lengkap, email, nomor telepon (08xx atau +62), kata sandi (min 8, huruf dan angka), konfirmasi kata sandi. PasswordChecklist: tiga baris live (Minimal 8 karakter, Ada huruf, Ada angka) dengan ikon centang success atau lingkaran kosong subtle, plus strength bar 3 segmen brand-fg. Konfirmasi kata sandi menampilkan centang success dan "Cocok" saat sama. Tombol "Buat akun" nonaktif sampai semua aturan terpenuhi.
- Submit POST /api/auth/register. Berhasil: simpan user ke authStore (emailVerified false) lalu navigasi ke /check-email.
- EMAIL_ALREADY_REGISTERED: "Email ini sudah terdaftar. Masuk atau gunakan email lain."
Acceptance: akun baru role customer, email verifikasi terkirim, validasi client dan server konsisten.
```

## B3a. Cek email (`pages/auth/CheckEmail.tsx`, route `/check-email`)
```
Baca docs/API_SPEC.md (resend-verification) dan lampiran desain Cek Email.

Wajib login. Jika emailVerified sudah true, redirect ke /.
- Tampilkan email user dan teks "Kami mengirim tautan verifikasi ... Tautan berlaku 24 jam." dan petunjuk cek folder spam.
- Tombol "Kirim ulang email": POST /api/auth/resend-verification. Cooldown 60 detik ditampilkan di label ("Kirim ulang dalam 45 detik"), baca `retry_after` dari respons atau error RESEND_TOO_SOON.
- RESEND_LIMIT_REACHED: "Terlalu banyak permintaan. Coba lagi dalam 1 jam."
- Link "Lanjut cari tiket" ke /.
- Polling ringan GET /api/auth/me tiap 5 detik atau saat tab kembali fokus; jika sudah terverifikasi, redirect ke tujuan awal.
Acceptance: kirim ulang tidak bisa dispam, status terverifikasi terdeteksi tanpa reload.
- UI: BrandPanel varian terkunci (FloatingPass dengan chip putus-putus "Menunggu verifikasi", QR diganti placeholder). Tiga langkah bernomor (Buka email dari SkyBook, Klik Verifikasi email, Kembali ke sini). Progress bar tipis brand-fg mengisi selama cooldown kirim ulang. Toast "Email dikirim ulang". Saat polling mendeteksi terverifikasi: tampilkan centang success singkat lalu redirect.
```

## B3b. Verifikasi email (`pages/auth/VerifyEmail.tsx`, route `/verify-email`)
```
Baca docs/API_SPEC.md (POST /api/auth/verify-email) dan lampiran desain Verifikasi Email.

Route publik (tautan bisa dibuka tanpa login atau di perangkat lain).
- Saat mount baca ?token= dan panggil POST /api/auth/verify-email. Lindungi dari dobel panggilan (React StrictMode) dengan useRef karena token sekali pakai.
- State: loading, sukses, TOKEN_EXPIRED, TOKEN_INVALID (teks sesuai desain).
- Sukses: jika sedang login, panggil GET /api/auth/me dan perbarui authStore; tombol "Cari penerbangan".
- Kedaluwarsa: jika login, tombol "Kirim tautan baru" memanggil resend-verification; jika tidak login, arahkan ke /login lalu /check-email.
Acceptance: token tidak terpakai dua kali, tampilan benar untuk pengguna login maupun tamu.
- UI: AuthLayout terbelah. FloatingPass di BrandPanel mengikuti status (sukses: QR tampil + chip success "Siap dipakai"; kedaluwarsa atau tidak valid: QR redup + chip danger). Varian kedaluwarsa memakai cooldown kirim ulang dengan progress bar tipis.
```

## Komponen: EmailVerificationBanner dan gerbang booking
```
Tambahkan di CustomerLayout: EmailVerificationBanner tampil di bawah navbar jika user login dan emailVerified false (teks "Email kamu belum terverifikasi. Verifikasi sebelum memesan tiket.", tombol teks "Kirim ulang email" memakai logika cooldown yang sama dengan /check-email). Hilang otomatis setelah terverifikasi.
Gerbang booking: di /flights/:id, jika emailVerified false tampilkan notice di atas step bar dan nonaktifkan tombol lanjut. Server tetap menegakkan aturan (403 EMAIL_NOT_VERIFIED); tangani error itu dengan menampilkan notice yang sama.
- Tombol "Kirim ulang email" punya state loading dan toast "Email dikirim".
```

---

# CUSTOMER - BOOKING FLOW

## B4. Search results (`pages/customer/SearchResults.tsx`, route `/search`)
```
Baca docs/API_SPEC.md (GET /api/flights/search) dan lampiran desain Hasil Pencarian dari Stitch.

Gunakan hook useFlightSearch (TanStack Query) yang membaca query string.
- Bar ringkasan di atas (rute, tanggal, penumpang, tombol "Ubah pencarian" membuka SearchPanel inline).
- Date strip 7 hari dengan harga termurah per hari (hari terpilih diberi garis bawah brand-fg, bukan pill). Revisi data real: data dari GET /api/flights/price-calendar (parameter origin, destination, date, passengers, class); hari tanpa penerbangan menampilkan "-" dan tidak bisa dipilih.
- Layout dua kolom: sidebar filter 280px (Tipe Langsung/Transit, rentang harga, maskapai, jam berangkat, "Reset filter") dan daftar hasil. Di bawah 1024px sidebar menjadi drawer.
- Sort: Termurah, Tercepat, Terbaik (sort=value; Termurah tetap default). Semua filter dan sort tersimpan di URL. Revisi data real: "Terbaik" hanya opsi ketiga di kontrol sort yang sama.
- Hasil berupa baris bergaris tipis (bukan kartu): wordmark + nomor penerbangan, RouteLine dengan waktu, durasi, harga per orang, tombol "Pilih". Transit menampilkan kota dan lama transit pada titik.
- "Tersisa N kursi" hanya jika sisa <= 5, warna danger.
- Revisi data real: jika `delay_minutes` > 0, di bawah waktu berangkat tampil teks danger + ikon jam "Tertunda 25 menit" dan perkiraan jam berangkat baru. Jika `layover_warning` = `short`, di titik transit tampil teks "Transit singkat" (danger, dengan ikon); jika `long`, "Transit lama" (subtle, dengan ikon). Penerbangan cancelled tidak muncul dari API.
- "Pilih" menuju /flights/:id?passengers=N&class=...; belum login akan diarahkan ke login lalu kembali.
State: skeleton 5 baris, EmptyState ("Tidak ada penerbangan di tanggal ini. Coba tanggal lain di strip atas."), ErrorState dengan tombol "Muat ulang".
Acceptance: filter dan sort bekerja bersama, back button mempertahankan filter.
- Interaksi: slider rentang harga dengan histogram kecil di atasnya (batang line, batang dalam rentang brand-fg), chip filter aktif yang bisa dihapus, baris hasil bisa dibuka inline dengan tab Penerbangan/Bagasi/Refund (timeline segmen), skeleton row saat memuat, hover baris memakai tint.
```

## B5 dan B6. Booking: data penumpang, kursi, bagasi (`pages/customer/BookingDetail.tsx`, route `/flights/:id`)
```
Baca docs/API_SPEC.md (GET /api/flights/:id, GET /api/baggage-options, POST /api/bookings), docs/DATABASE_SCHEMA.md dan lampiran desain Data Penumpang serta Kursi dan Bagasi dari Stitch.

Wajib login dan email terverifikasi (lihat gerbang booking di atas). Satu halaman dengan dua langkah, state di Zustand (bookingStore). Step bar menampilkan "Data penumpang", "Kursi dan bagasi", "Bayar".
Layout dua kolom: konten utama kiri, panel ringkasan harga sticky kanan (360px).
Langkah 1 Data penumpang:
- Ringkasan penerbangan (RouteLine, maskapai, kelas). Revisi data real: jika tertunda, tambahkan satu baris teks "Tertunda 25 menit, perkiraan berangkat 08.05".
- Satu section expandable per penumpang: nama lengkap, nomor identitas, tanggal lahir, jenis kelamin. Validasi zod. Section belum lengkap diberi "Belum lengkap" warna danger.
- Tombol "Lanjut pilih kursi".
Langkah 2 Kursi dan bagasi:
- SeatMap (src/components/booking/SeatMap.tsx): fuselage vertikal, layout 3-3 dengan lorong, nomor baris, penanda pintu darurat. Status: tersedia, terisi (silang), dipilih (signal + centang on-signal). Tersedia dari data seats penerbangan. Tab penumpang untuk mengganti penumpang yang sedang dipilihkan kursi.
- Bagasi tambahan per penumpang: radio list dari GET /api/baggage-options.
- Tautan "Pilih kursi saat check-in" mengosongkan seat_id (opsional).
- Panel ringkasan menghitung total otomatis (tiket x jumlah, bagasi).
- Tombol "Lanjut ke pembayaran" memanggil POST /api/bookings, lalu navigasi ke /checkout/:bookingId.
Error SEAT_NOT_AVAILABLE: "Kursi 14A baru saja dipilih penumpang lain. Pilih kursi lain." dan seat map dimuat ulang.
Error FLIGHT_CANCELLED: "Penerbangan ini dibatalkan maskapai. Cari penerbangan lain." dengan tombol ke /search.
Acceptance: multi-penumpang bekerja, double booking kursi ditangani, state tidak hilang saat pindah langkah.
- Interaksi: step bar berupa garis bertitik yang terisi brand-fg sampai langkah aktif; header penumpang menampilkan "3 dari 4 terisi" atau centang success; date picker popover untuk tanggal lahir; counter nomor identitas; jenis kelamin sebagai segmented control; toast "Data penumpang 1 disimpan"; ringkasan harga collapsible.
- SeatMap: tooltip saat hover dan fokus keyboard ("Kursi 15C, lorong, gratis"; pintu darurat "Ruang kaki lebih luas" + label +Rp 90.000), kontrol zoom, switcher penumpang berupa tab, total harga live.
```

## B7. Checkout (`pages/customer/Checkout.tsx`, route `/checkout/:bookingId`)
```
Baca docs/API_SPEC.md (Payment) dan lampiran desain Pembayaran dari Stitch.

- GET /api/bookings/:id; tampilkan ringkasan penerbangan, penumpang (kursi dan bagasi), rincian harga.
- Countdown batas bayar memakai `expires_at` dari API (1 jam setelah created_at) (hook useCountdown, format "58.12"). Saat habis: "Pesanan dibatalkan karena belum dibayar. Cari penerbangan lagi." dengan tombol ke /.
- Tombol "Bayar sekarang": POST /api/payment/create, buka Midtrans Snap (snap.pay(token)) dengan callback onSuccess/onPending/onClose menuju /payment/result?booking=ID. Muat script Snap sandbox hanya di halaman ini.
- Jika booking bukan pending, redirect ke /bookings/:id.
Acceptance: pembayaran sandbox berjalan, menutup popup tidak merusak state, tidak bisa dibayar dua kali.
- Interaksi: progress bar tipis brand-fg untuk sisa waktu bayar (useCountdown), metode bayar sebagai baris radio yang terbuka saat dipilih, "Rincian harga" collapsible, link "Ubah kursi" per penumpang.
```

## B8. Payment result (`pages/customer/PaymentResult.tsx`, route `/payment/result`)
```
Baca lampiran desain Pembayaran Berhasil dari Stitch.

Jangan percaya query string untuk status.
- GET /api/bookings/:id lalu tampilkan sesuai status sebenarnya. Jika masih pending, polling tiap 3 detik maksimal 60 detik (menunggu webhook), lalu tampilkan "Menunggu konfirmasi pembayaran" dengan tombol "Cek lagi".
- paid: ikon centang success, "Pembayaran berhasil", kode booking besar + tombol "Salin", ringkasan penerbangan, tombol utama "Unduh e-tiket" dan outline "Lihat pesanan", catatan jadwal check-in.
- failed/cancelled: pesan jelas dan tombol "Coba bayar lagi" atau "Cari penerbangan lagi".
Acceptance: benar saat direfresh dan saat webhook terlambat.
- Interaksi: tombol "Salin" berubah jadi "Tersalin" dengan ikon centang dan toast; garis rute brand-fg dengan ikon pesawat kecil di panel ringkasan; timeline "Langkah berikutnya" (Pembayaran diterima, E-tiket tersedia di akunmu, Check-in dibuka dengan hitung mundur live, Boarding). Tetap tenang: tanpa confetti.
```

## B9. My bookings (`pages/customer/MyBookings.tsx`, route `/bookings`)
```
Baca docs/API_SPEC.md (GET /api/bookings/my) dan lampiran desain Pesanan Saya dari Stitch.

- Tabs "Akan datang" dan "Riwayat" (pisah berdasarkan departure_time dan status).
- Setiap item adalah ticket-style row: AirportCode besar, tanggal dan jam, nomor penerbangan, kode booking, StatusChip, aksi di kanan. Pending menampilkan sisa waktu dan tombol "Bayar". Jika H-24 jam dan paid, tombol "Check-in".
- Revisi data real: jika penerbangan tertunda, tampilkan teks "Tertunda 25 menit" di samping jam; jika dibatalkan, tampilkan chip gaya `cancelled` "Dibatalkan maskapai" dan aksi "Ajukan refund".
- Klik item menuju /bookings/:id.
- EmptyState: "Belum ada pesanan. Cari penerbangan pertamamu."
Acceptance: urutan, status, dan aksi sesuai kondisi waktu.
- Interaksi: jumlah di tab ("Akan datang 3"), kolom "Cari kode booking", garis rute mini per baris, hover baris memakai tint, progress bar tipis untuk sisa waktu bayar (useCountdown), EmptyState di tab Riwayat ("Belum ada riwayat. Pesanan yang sudah lewat akan muncul di sini.").
```

## B10. E-ticket and refund (`pages/customer/BookingTicket.tsx`, route `/bookings/:id`)
```
Baca docs/API_SPEC.md (GET /api/bookings/:id, e-ticket, Refund) dan lampiran desain E-Tiket dari Stitch.

- Header: kode booking, StatusChip, tombol "Unduh PDF" (GET /api/bookings/:id/e-ticket, hanya status paid) dan tautan "Ajukan refund".
- TicketPanel landscape per penumpang dengan perforasi vertikal: maskapai, AirportCode besar, tanggal, waktu, nomor penerbangan, kelas, nama, kursi; stub kanan berisi QR dan kode booking.
- "Ajukan refund" membuka Dialog: textarea alasan (min 10 karakter), estimasi jumlah refund, tombol "Batal" dan "Ajukan refund". Nonaktif dengan keterangan jika kurang dari 6 jam sebelum berangkat atau status bukan paid. Submit POST /api/refunds.
- Jika sudah ada refund, tampilkan StatusChip dan riwayat statusnya.
- Revisi data real, tertunda: satu baris di bawah header "Tertunda 25 menit, perkiraan berangkat 08.05" (teks danger + ikon jam).
- Revisi data real, dibatalkan: panel catatan di atas tiket (teks danger + ikon silang) "Penerbangan dibatalkan maskapai. Kamu berhak refund penuh." Tombol "Ajukan refund" tetap aktif meski kurang dari 6 jam sebelum berangkat. Dialog refund menampilkan estimasi sebesar total booking, textarea alasan terisi "Penerbangan dibatalkan maskapai" dan tidak wajib diubah (RFD-05).
Acceptance: aturan H-6 jam benar di UI dan ditegakkan server.
- Interaksi: QR dengan tombol "Perbesar" (dialog), tab penumpang (tiket kedua collapsed), bar jendela refund ("Sisa 40 jam sebelum batas refund"), dialog refund dengan counter textarea (maks 300), estimasi refund besar, tombol state loading.
```

## B11 dan B12. Check-in and boarding pass (`pages/customer/CheckIn.tsx`, route `/check-in/:bookingId`)
```
Baca docs/API_SPEC.md (Check-in) dan lampiran desain Check-in serta Boarding Pass dari Stitch.

- Validasi waktu: check-in dibuka 24 jam sebelum keberangkatan. Jika belum, tampilkan hitung mundur dan tombol nonaktif ("Check-in dibuka 13 Okt, 07.40").
- Revisi data real: jika penerbangan dibatalkan, tombol check-in nonaktif dengan keterangan "Penerbangan dibatalkan. Ajukan refund dari halaman pesanan." Jika tertunda, check-in tetap berjalan dan boarding pass menampilkan jam boarding yang sudah diperbarui, waktu buka check-in tetap dari jadwal asli.
- Daftar penumpang dengan checkbox. Yang sudah check-in menampilkan kursi dan tombol "Lihat boarding pass".
- "Ganti kursi" membuka SeatMap (reuse). Kursi baru harus tersedia.
- Tombol "Selesaikan check-in": POST /api/check-in/:bookingId untuk tiap penumpang terpilih.
- Setelah sukses tampilkan boarding pass (TicketPanel landscape): nama, penerbangan, kursi, jam boarding, QR, kode boarding (berbeda dari kode booking), tombol "Simpan boarding pass" (GET /api/check-in/:bookingId/boarding-pass sebagai PDF) dan "Kembali ke pesanan".
Acceptance: tidak bisa check-in dua kali, perubahan kursi aman dari race condition.
- Interaksi check-in: hitung mundur "Check-in ditutup dalam ..." dengan progress bar tipis; baris penumpang tercentang memakai tint; "Ganti kursi" membuka SeatMap kompak inline (baris di sekitar kursi, tooltip, kursi terpilih signal); ringkasan "2 penumpang, kursi 14A dan 14B"; tombol state loading.
- Interaksi boarding pass: garis rute dengan ikon pesawat, chip success "Siap boarding", hitung mundur live "Boarding 07.10, 2j 14m lagi", tab penumpang, catatan "Naikkan kecerahan layar saat dipindai".
```

---

# ADMIN

## B13. Dashboard (`pages/admin/Dashboard.tsx`, route `/admin`)
```
Baca lampiran desain Admin Dashboard. Endpoint GET /api/admin/dashboard harus ada di backend.

- Satu kalimat ringkasan: "Hari ini: N pesanan, Rp X pendapatan, N refund menunggu persetujuan."
- Satu chart besar pesanan per hari (recharts, garis brand-fg, tanpa gradient fill, tooltip sederhana), data dari `bookings_by_day`; rentang 7/30/90 hari lewat query `?range=` pada GET /api/admin/dashboard (default 30).
- Dua tabel berdampingan: Keberangkatan berikutnya dan Refund menunggu (aksi inline Setujui/Tolak memanggil PUT /api/admin/refunds/:id).
- Tanpa grid kartu KPI identik.
Acceptance: data real dari API, aksi refund memperbarui tabel tanpa reload.
- Interaksi: segmented control "7 hari | 30 hari | 90 hari"; chart dengan crosshair, titik, dan tooltip saat hover (recharts Tooltip kustom); baris "Refund menunggu" menampilkan tombol ikon saat hover; toast "Refund ... disetujui" dengan link "Lihat refund".
```

## B14. Master data: Airports, Airlines, Airplanes, Baggage
```
Baca docs/API_SPEC.md (Admin - Airports/Airlines/Airplanes/Baggage Options) dan docs/DATABASE_SCHEMA.md.

Buat komponen generik DataTablePage (src/components/admin) dan pakai untuk
/admin/airports, /admin/airlines, /admin/airplanes, /admin/baggage-options.
Generik: header judul + pencarian + tombol utama "Tambah ...", tabel baris bergaris tipis, paginasi, aksi Ubah (Dialog form) dan Hapus (Dialog konfirmasi spesifik, contoh "Hapus bandara CGK? Jadwal yang memakai bandara ini akan terpengaruh.").
Field:
- Airports: code (3 huruf, uppercase otomatis), name, city, country.
- Airlines: name, code, logo (upload atau URL).
- Airplanes: airline (select), registration_number, model, total_seat_economy, total_seat_business.
- Baggage options: name, weight_kg, price.
Validasi zod sama dengan backend, tampilkan error server (misal kode duplikat) di field terkait. Toast memakai kata kerja yang sama dengan tombol ("Disimpan", "Dihapus").
Acceptance: CRUD penuh untuk empat entitas dengan satu komponen yang dipakai ulang.
- Interaksi: hover baris (tint, tombol Ubah dan Hapus menonjol), header kolom bisa diurutkan dengan ikon panah, pencarian memfilter langsung dan menandai huruf yang cocok (tint), validasi dialog (kode 3 huruf dengan centang success atau error "Kode harus 3 huruf"), toast setelah simpan.
```

## B15. Flights list (`pages/admin/Flights.tsx`, route `/admin/flights`)
```
Baca docs/API_SPEC.md (Admin - Flight Schedules) dan lampiran desain Jadwal Penerbangan.

- Filter: maskapai, tipe, status, rentang tanggal; pencarian nomor penerbangan.
- Tabel: nomor penerbangan, maskapai, rute (CGK ke DPS atau CGK ke SUB ke UPG), berangkat, tiba, tipe, kursi terisi ("112 / 180" + progress bar brand-fg tipis), StatusChip, menu aksi (Ubah, Ubah status, Hapus).
- Hapus diblokir jika sudah ada booking, tampilkan alasan jelas.
- Revisi data real: di bawah nomor penerbangan tampil teks kecil subtle "Impor API" untuk jadwal `source = 'api'`. Dialog "Ubah status" yang sudah ada diberi opsi tertunda dengan field menit keterlambatan (wajib > 0) dan peringatan "Pelanggan dengan pesanan lunas akan menerima email." Perubahan ini memicu NTF-01.
Acceptance: join airline dan airplane dari API, paginasi server-side.
- Interaksi: header kolom bisa diurutkan, filter aktif sebagai chip yang bisa dihapus, kolom checkbox dengan bar "N dipilih" (Ubah status, Hapus), menu baris sebagai dropdown (Hapus bernuansa danger).
```

## B16. Flight form (`pages/admin/FlightForm.tsx`, route `/admin/flights/new` dan `/admin/flights/:id/edit`)
```
Baca docs/API_SPEC.md (POST /api/admin/flights), docs/DATABASE_SCHEMA.md dan lampiran desain Form Jadwal.

- Kolom kiri: nomor penerbangan, maskapai, pesawat (filter per maskapai, tampilkan kapasitas), tipe (segmented Langsung/Transit), harga ekonomi, harga bisnis.
- Kolom kanan: Segmen perjalanan sebagai timeline vertikal. Langsung = tepat 1 segmen, Transit = minimal 2. Field per segmen: asal, tujuan, berangkat, tiba. Lama transit antar segmen dihitung otomatis dan tampil sebagai pemisah. Tombol "Tambah segmen" dan hapus segmen.
- Validasi: asal segmen n+1 = tujuan segmen n, tiba setelah berangkat, berangkat segmen n+1 setelah tiba segmen n.
- Footer sticky: catatan "Kursi dibuat otomatis sesuai kapasitas pesawat", "Batal", "Simpan jadwal".
- Mode edit: jika sudah ada booking, kunci field yang mengubah kursi atau harga dan beri penjelasan.
Acceptance: transit 2 dan 3 segmen tersimpan benar, seats ter-generate di backend.
- Interaksi: segmented control Langsung/Transit, kapasitas pesawat tampil setelah dipilih, time picker popover untuk jam segmen, durasi transit dihitung live, tombol ikon hapus segmen saat hover, dan baris "Pratinjau di hasil pencarian" memakai komponen FlightRow yang sama dengan SearchResults.
```

## B17. Users (`pages/admin/Users.tsx`, route `/admin/users`)
```
Baca docs/API_SPEC.md (Admin - Users) dan lampiran desain Pengguna.

- Tabel: nama, email, telepon, role (chip outline ink), status aktif, tanggal daftar. Filter role dan pencarian.
- Tombol "Tambah staf": Dialog (nama, email, telepon, kata sandi sementara), role otomatis staff (AUTH-03), email langsung dianggap terverifikasi.
- Aksi: ubah role (admin tidak bisa menurunkan dirinya sendiri), aktifkan/nonaktifkan dengan konfirmasi.
Acceptance: staf baru bisa login ke /staff, admin tidak bisa mengunci dirinya sendiri.
- Interaksi: avatar bulat berinisial (tint, teks ink), pencarian menandai huruf yang cocok, menu baris sebagai dropdown (Nonaktifkan bernuansa danger), tombol "Buat otomatis" untuk kata sandi sementara dengan tombol mata tampil/sembunyi.
```

## B18. Refunds (`pages/admin/Refunds.tsx`, route `/admin/refunds`)
```
Baca docs/API_SPEC.md (Admin - Refunds) dan lampiran desain Refund.

- Tabs Menunggu, Disetujui, Ditolak dengan jumlah. Tabel: kode booking, penumpang, rute, alasan (dipotong), jumlah refund, tanggal ajukan, aksi.
- Klik baris membuka panel detail kanan (400px, bukan modal): alasan lengkap, jam berangkat, sisa jam sebelum berangkat, jumlah refund, tombol "Setujui refund" dan "Tolak" (wajib catatan).
- Aksi memanggil PUT /api/admin/refunds/:id, update optimistik dengan rollback jika gagal. Status refunded setelah dana dikembalikan (RFD-03).
Acceptance: status berpindah benar dan tercermin di sisi customer.
- Interaksi: jumlah di tab, baris terpilih memakai tint, bar waktu di panel detail dari "Diajukan ..." ke "Berangkat ..." dengan penanda sekarang dan teks "Sisa 40 jam", textarea catatan penolakan dengan counter (maks 300) dan hint "Catatan wajib diisi", toast setelah setujui atau tolak.
```

---

# STAFF

## B19. Dashboard (`pages/staff/Dashboard.tsx`, route `/staff`)
```
Endpoint GET /api/staff/flights harus ada di backend.

Daftar penerbangan hari ini urut jam berangkat, baris bergaris tipis: nomor penerbangan, rute, jam berangkat besar, progres check-in "142 / 180" dengan bar tipis, StatusChip, tautan "Buka manifest" dan "Verifikasi boarding".
EmptyState: "Tidak ada penerbangan hari ini."
Acceptance: staf hanya melihat penerbangan relevan, navigasi benar.
- Interaksi: ThemeToggle di topbar, segmented control "Semua | Akan berangkat | Selesai", penerbangan berikutnya disorot tint dengan teks "Berangkat dalam ..." (useCountdown), hover baris menonjolkan tombol teks.
```

## B20. Manifest (`pages/staff/Manifest.tsx`, route `/staff/flights/:id/manifest`)
```
Baca docs/API_SPEC.md (GET /api/staff/flights/:id/manifest, PUT /api/staff/passengers/:id/status) dan lampiran desain Manifest.

- Header info penerbangan dan hitungan teks: "180 penumpang, 142 check-in, 96 naik pesawat". Pencarian dan filter status.
- Tabel: kursi, nama, nomor identitas (dimasking, 3201********10), bagasi, StatusChip. Urut kursi.
- Aksi inline pada baris check-in: "Tandai naik" dan "Tandai tidak hadir" (STF-03) dengan konfirmasi ringan.
- Refresh otomatis tiap 15 detik tanpa mengganggu posisi scroll.
Acceptance: perubahan status langsung terlihat, identitas tidak pernah tampil penuh.
- Interaksi: stacked progress bar tiga kelompok (belum check-in line, check-in brand-fg, naik pesawat success), chip filter dengan jumlah, pencarian menandai huruf yang cocok, hover baris menonjolkan tombol inline, baris yang baru diperbarui disorot tint sebentar, toast "Rina Wulandari ditandai naik pesawat".
```

## B21. Verify boarding (`pages/staff/ScanBoarding.tsx`, route `/staff/scan`)
```
Baca docs/API_SPEC.md (POST /api/staff/verify-boarding) dan lampiran desain Verifikasi Boarding.

- Dua kolom. Kiri: input "Kode boarding" autofocus (untuk scanner genggam yang mengetik kode lalu Enter), tombol "Verifikasi", dan viewfinder webcam yang hanya aktif setelah klik "Gunakan kamera" (pustaka QR seperti @yudiel/react-qr-scanner).
- Kanan: panel hasil: nama, kursi, nomor penerbangan, StatusChip, tombol utama "Tandai naik pesawat".
- Error spesifik: BOARDING_CODE_NOT_FOUND, ALREADY_BOARDED, WRONG_FLIGHT, dengan langkah berikutnya jelas. Setelah sukses input dikosongkan dan fokus kembali ke input.
Acceptance: scan berulang cepat tanpa mouse, kode yang sama tidak bisa ditandai dua kali.
- Interaksi: penghitung "96 / 180 naik pesawat" di atas, viewfinder dengan empat sudut brand-fg dan garis pindai statis, tiga varian hasil (sukses success, sudah naik: info subtle "Sudah naik pesawat pukul ...", tidak ditemukan: danger dengan langkah berikutnya), daftar "Scan terakhir" 5 baris (state lokal).
```

---

# BACKEND TAMBAHAN (data real)

## Prompt P - Data provider, job, dan notifikasi (backend, tanpa UI)
```
Baca docs/PRD.md (bagian Data Penerbangan, Fitur Pembeda, dan bagian 8), docs/API_SPEC.md (Data Provider dan Jobs, Flight Search, price-calendar), docs/DATABASE_SCHEMA.md (kolom baru flight_schedules, airports.timezone, refunds.kind, tabel flight_notifications, provider_usage, provider_cache).

Tidak ada perubahan UI di prompt ini. Kerjakan berurutan dan uji tiap langkah:

1. Migrasi Drizzle baru (jangan mengedit migrasi awal) untuk semua kolom dan tabel baru, termasuk unique index parsial (source, external_ref) dan `flight_schedules.created_by` menjadi nullable. Kode CRUD jadwal dan auto-generate seats sudah ada, pakai ulang.
2. Script `seed:reference`: impor airports dan airlines dari dataset terbuka (OpenFlights atau OurAirports) untuk bandara Indonesia dan bandara internasional utama, termasuk timezone. Buat satu pesawat default per maskapai (registration_number `DEFAULT-<kode maskapai>`, kapasitas dari env). Script harus idempotent.
3. Lapisan provider di src/server/provider/: interface FlightDataProvider, implementasi AeroDataBox (baca dokumentasi resminya, jangan menebak nama endpoint atau field), cache di provider_cache (TTL jadwal 12 jam, status 15 menit), dan penjaga kuota di provider_usage (berhenti di 90% dari PROVIDER_MONTHLY_LIMIT, biaya unit per endpoint dari env). Kunci API hanya dari env. Endpoint publik tidak boleh memanggil lapisan ini.
4. Sebelum membangun impor, buat script uji kecil yang memanggil provider untuk 3 sampai 5 rute Indonesia dan laporkan cakupan datanya. Jika cakupan buruk, berhenti dan laporkan.
5. Job import-schedules (node-cron): upsert flight_schedules `source = 'api'` dengan satu segmen, harga simulasi dari rumus (parameter env), seats digenerate lewat fungsi auto-generate seats yang sudah ada (ADM-07) dalam satu transaksi. Jangan mengubah harga, pesawat, atau kursi jadwal yang sudah punya booking.
6. Job sync-status: sesuai DAT-06. Perbarui status dan delay_minutes, lalu panggil layanan notifikasi.
7. Layanan notifikasi: email delay dan cancel lewat Nodemailer, dedupe lewat flight_notifications, gagal kirim dicatat dan tidak melempar error ke job. Perubahan status manual lewat PUT /api/admin/flights/:id juga memanggil layanan yang sama.
8. Endpoint: GET /api/flights/price-calendar, tambahan field di GET /api/flights/search (status, delay_minutes, value_score, layover_warning, sort=value, tanpa penerbangan cancelled), field di GET /api/flights/:id, endpoint /api/admin/provider/*, dan perubahan PUT /api/admin/flights/:id.
9. Aturan cancelled: FLIGHT_CANCELLED pada POST /api/bookings dan POST /api/check-in, serta RFD-05 pada POST /api/refunds (tanpa batas H-6, refund_amount penuh, reason otomatis, refunds.kind = 'flight_cancelled').
10. Tes: impor idempotent, impor tidak menyentuh jadwal yang sudah dibooking, sync-status tidak jalan saat kuota 90%, notifikasi tidak terkirim dobel, pencarian tetap jalan saat provider dimatikan, price-calendar dan value_score benar untuk kasus direct dan transit.
Acceptance: seluruh alur booking sampai boarding tetap berjalan dengan provider dimatikan; kuota bulanan tidak terlampaui; tidak ada panggilan provider dari request publik.
```