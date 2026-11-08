# 🔴 JKT48 Multi-View Live Streaming (IDN Live & SHOWROOM)

Aplikasi web modern untuk menonton siaran langsung (live streaming) para member JKT48 secara bersamaan (*multi-view / multi-screen*) dari dua platform utama: **IDN Live** dan **SHOWROOM**.

---

## ✨ Fitur Unggulan

1. **Multi-Screen Grid Player**:
   - Dukungan hingga 9 layar secara bersamaan.
   - Pilihan layout fleksibel: **Auto Grid**, **1x1 (Fokus)**, **1x2 (Split)**, **3 Layar (1 Layar Utama + 2 Layar Samping)**, **4 Layar (2x2 Quad)**, dan **6 Layar (3x2 Wall)**.
   - Menggunakan pemutar **HLS.js** dengan *low-latency live sync*.

2. **Deteksi Otomatis Siaran Langsung (Live Tracker)**:
   - Secara *real-time* mendeteksi siapa saja member JKT48 yang sedang siaran di **IDN Live** dan **SHOWROOM**.
   - Menampilkan total penonton, judul live, dan foto profil member.
   - Tombol **"Tonton Semua Live"**: Satu klik untuk langsung membuka semua siaran aktif ke dalam grid.

3. **Smart Solo Audio Focus**:
   - Fitur **Solo Audio**: Klik ikon headset (`Solo`) pada salah satu layar untuk langsung mendengarkan member tersebut dan otomatis mematikan suara (*mute*) layar lainnya agar tidak tabrakan/bising.
   - Slider volume independen per layar.
   - Tombol Master Mute untuk mematikan semua audio sekaligus.

4. **Bypass CORS Otomatis**:
   - Server Node.js proxy otomatis menangani pembatasan CORS pada feed manifest `.m3u8` IDN Live sehingga video dapat diputar mulus di browser.

5. **Live Chat Log**:
   - Fitur obrolan real-time untuk SHOWROOM dan tautan langsung ke obrolan IDN Live.

6. **Keyboard Shortcuts**:
   - `M`: Master Mute / Unmute
   - `F`: Fullscreen Grid
   - `R`: Refresh status live
   - `1` - `9`: Solo audio ke layar nomor 1 sampai 9

---

## 🚀 Cara Menjalankan

### Cara 1 (Paling Mudah)
Cukup klik ganda (double click) file **`start.bat`** di folder proyek ini. Browser akan otomatis terbuka ke `http://localhost:3000`.

### Cara 2 (Terminal / Command Prompt)
```bash
cd C:\Users\Kelvin\jkt48-multiview
npm start
```
Buka browser di: **`http://localhost:3000`**

---

Dibuat khusus untuk para penggemar JKT48. Selamat menonton oshimen kalian! 🎉
