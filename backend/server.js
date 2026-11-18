const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const db = require("./config/database");
const siswaRoutes = require("./routes/siswaRoutes");

const app = express();

// ========================================
// 1. PENGATURAN DASAR
// ========================================

const PORT = process.env.PORT || 3000;

// ========================================
// 2. MIDDLEWARE
// ========================================

app.use(cors());

app.use(
  express.json({
    limit: "1mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,
  }),
);

// ========================================
// 3. FILE FRONTEND
// ========================================

app.use(express.static(path.join(__dirname, "../frontend")));

// ========================================
// 4. TES SERVER
// GET /api/test
// ========================================

app.get("/api/test", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server Express berhasil berjalan!",
    waktu: new Date().toISOString(),
  });
});

// ========================================
// 5. TES DATABASE
// GET /api/database
// ========================================

app.get("/api/database", async (req, res) => {
  try {
    const result = await db.query("SELECT CURRENT_TIMESTAMP AS waktu_database");

    res.status(200).json({
      status: "success",
      message: "Database PostgreSQL berhasil terhubung!",
      database: process.env.DB_NAME,
      waktu: result.rows[0].waktu_database,
    });
  } catch (error) {
    console.error("Database Error:", error);

    res.status(500).json({
      status: "error",
      message: "Database PostgreSQL tidak dapat dihubungkan.",
    });
  }
});

// ========================================
// 6. ROUTE SISWA
// ========================================

app.use("/api/siswa", siswaRoutes);

console.log("ROUTE SISWA BERHASIL DIMUAT");

// ========================================
// 7. HALAMAN UTAMA
// GET /
// ========================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ========================================
// 8. PENANGANAN ROUTE TIDAK DITEMUKAN
// ========================================

app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Endpoint tidak ditemukan.",
    endpoint: req.originalUrl,
  });
});

// ========================================
// 9. PENANGANAN ERROR SERVER
// ========================================

app.use((error, req, res, next) => {
  console.error("Server Error:", error);

  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({
      status: "error",
      message: "Format JSON yang dikirim tidak valid.",
    });
  }

  res.status(500).json({
    status: "error",
    message: "Terjadi kesalahan pada server.",
  });
});

// ========================================
// 10. MENJALANKAN SERVER
// ========================================

async function jalankanServer() {
  try {
    // Periksa koneksi PostgreSQL
    await db.query("SELECT 1");

    console.log("DATABASE POSTGRESQL BERHASIL TERHUBUNG");

    app.listen(PORT, () => {
      console.log("------------------------------------");
      console.log("APLIKASI DATA SISWA BERHASIL DIMULAI");
      console.log("------------------------------------");
      console.log(`Server : http://localhost:${PORT}`);
      console.log(`API    : http://localhost:${PORT}/api/test`);
      console.log(`DB     : http://localhost:${PORT}/api/database`);
      console.log("------------------------------------");
    });
  } catch (error) {
    console.error("GAGAL MENJALANKAN SERVER");
    console.error("Periksa konfigurasi database dan file .env");
    console.error(error.message);

    process.exit(1);
  }
}

jalankanServer();
