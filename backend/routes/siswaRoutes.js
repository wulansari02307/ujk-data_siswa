const express = require("express");
const router = express.Router();
const db = require("../config/database");

// ========================================
// 1. FUNGSI BANTUAN
// ========================================

// Validasi NISN harus 6 angka
function validasiNISN(nisn) {
  return /^[0-9]{6}$/.test(String(nisn || ""));
}

// Mengambil nama pelaku aktivitas
function ambilPelaku(req, field) {
  return String(req.body?.[field] || "Admin")
    .trim()
    .slice(0, 150);
}

// Menangani error database
function tanganiError(res, error) {
  console.error("Database Error:", error);

  if (error.code === "23505") {
    return res.status(409).json({
      status: "error",
      message:
        "NISN sudah terdaftar. Periksa tempat sampah jika data pernah dihapus.",
    });
  }

  if (error.code === "23514") {
    return res.status(400).json({
      status: "error",
      message: "Data tidak memenuhi aturan tabel.",
    });
  }

  if (error.code === "23503") {
    return res.status(409).json({
      status: "error",
      message:
        "Data tidak dapat diproses karena masih memiliki relasi dengan data lain.",
    });
  }

  if (error.code === "22007" || error.code === "22008") {
    return res.status(400).json({
      status: "error",
      message: "Format tanggal lahir tidak valid.",
    });
  }

  return res.status(500).json({
    status: "error",
    message: "Terjadi kesalahan pada server.",
  });
}

// ========================================
// 2. TRANSAKSI DATABASE
// ========================================

async function denganTransaksi(callback) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const hasil = await callback(client);

    await client.query("COMMIT");

    return hasil;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback Error:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}

// ========================================
// 3. CATAT RIWAYAT AKTIVITAS
// ========================================

async function catatAktivitas(client, siswa, aktivitas, pelaku, keterangan) {
  await client.query(
    `INSERT INTO riwayat_aktivitas
      (nisn, nama_siswa, aktivitas, dilakukan_oleh, keterangan)
     VALUES ($1, $2, $3, $4, $5)`,
    [siswa.nisn, siswa.nama_siswa, aktivitas, pelaku || "Admin", keterangan],
  );
}

// ========================================
// 4. READ - DATA SISWA AKTIF
// GET /api/siswa
// GET /api/siswa?search=Ahmad
// GET /api/siswa?jurusan=IPA
// ========================================

router.get("/", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const jurusan = String(req.query.jurusan || "").trim();

    let sql = `
      SELECT *
      FROM siswa
      WHERE deleted_at IS NULL
    `;

    const values = [];

    if (search) {
      values.push(`%${search}%`);

      sql += `
        AND (
          nisn ILIKE $${values.length}
          OR nama_siswa ILIKE $${values.length}
        )
      `;
    }

    if (jurusan) {
      values.push(`%${jurusan}%`);

      sql += ` AND jurusan ILIKE $${values.length}`;
    }

    sql += ` ORDER BY nisn ASC`;

    const result = await db.query(sql, values);

    res.status(200).json({
      status: "success",
      jumlah: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    tanganiError(res, error);
  }
});

// ========================================
// 5. READ - TEMPAT SAMPAH
// GET /api/siswa/sampah
// ========================================

router.get("/sampah", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM siswa
      WHERE deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `);

    res.status(200).json({
      status: "success",
      jumlah: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    tanganiError(res, error);
  }
});

// ========================================
// 6. READ - RIWAYAT AKTIVITAS
// GET /api/siswa/riwayat
// ========================================

router.get("/riwayat", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM riwayat_aktivitas
      ORDER BY created_at DESC, id DESC
      LIMIT 200
    `);

    res.status(200).json({
      status: "success",
      jumlah: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    tanganiError(res, error);
  }
});

// ========================================
// 7. RESTORE - PULIHKAN SISWA
// POST /api/siswa/pulihkan/:nisn
// ========================================

router.post("/pulihkan/:nisn", async (req, res) => {
  try {
    const { nisn } = req.params;
    const pelaku = ambilPelaku(req, "dilakukan_oleh");

    if (!validasiNISN(nisn)) {
      return res.status(400).json({
        status: "error",
        message: "NISN harus terdiri dari 6 angka.",
      });
    }

    const siswa = await denganTransaksi(async (client) => {
      const result = await client.query(
        `UPDATE siswa
         SET deleted_at = NULL,
             deleted_by = NULL
         WHERE nisn = $1
           AND deleted_at IS NOT NULL
         RETURNING *`,
        [nisn],
      );

      if (result.rowCount === 0) {
        return null;
      }

      const data = result.rows[0];

      await catatAktivitas(
        client,
        data,
        "PULIHKAN",
        pelaku,
        "Data siswa dipulihkan dari tempat sampah.",
      );

      return data;
    });

    if (!siswa) {
      return res.status(404).json({
        status: "error",
        message: "Data siswa di tempat sampah tidak ditemukan.",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Data siswa berhasil dipulihkan.",
      data: siswa,
    });
  } catch (error) {
    tanganiError(res, error);
  }
});

// ========================================
// 8. READ - DETAIL SISWA
// GET /api/siswa/:nisn
// ========================================

router.get("/:nisn", async (req, res) => {
  try {
    const { nisn } = req.params;

    if (!validasiNISN(nisn)) {
      return res.status(400).json({
        status: "error",
        message: "NISN harus terdiri dari 6 angka.",
      });
    }

    const result = await db.query(
      `SELECT *
       FROM siswa
       WHERE nisn = $1
         AND deleted_at IS NULL`,
      [nisn],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "Data siswa tidak ditemukan.",
      });
    }

    res.status(200).json({
      status: "success",
      data: result.rows[0],
    });
  } catch (error) {
    tanganiError(res, error);
  }
});

// ========================================
// 9. CREATE - TAMBAH SISWA
// POST /api/siswa
// ========================================

router.post("/", async (req, res) => {
  try {
    const { nisn, nama_siswa, alamat, tempat_lahir, tanggal_lahir, jurusan } =
      req.body || {};

    const pelaku = ambilPelaku(req, "created_by");

    if (!validasiNISN(nisn)) {
      return res.status(400).json({
        status: "error",
        message: "NISN wajib terdiri dari 6 angka.",
      });
    }

    if (typeof nama_siswa !== "string" || nama_siswa.trim() === "") {
      return res.status(400).json({
        status: "error",
        message: "Nama siswa wajib diisi.",
      });
    }

    const siswa = await denganTransaksi(async (client) => {
      const result = await client.query(
        `INSERT INTO siswa (
          nisn,
          nama_siswa,
          alamat,
          tempat_lahir,
          tanggal_lahir,
          jurusan,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          nisn,
          nama_siswa.trim(),
          alamat || null,
          tempat_lahir || null,
          tanggal_lahir || null,
          jurusan || null,
          pelaku,
        ],
      );

      const data = result.rows[0];

      await catatAktivitas(
        client,
        data,
        "TAMBAH",
        pelaku,
        "Menambahkan data siswa baru.",
      );

      return data;
    });

    res.status(201).json({
      status: "success",
      message: "Data siswa berhasil ditambahkan.",
      data: siswa,
    });
  } catch (error) {
    tanganiError(res, error);
  }
});

// ========================================
// 10. UPDATE - EDIT SISWA
// PUT /api/siswa/:nisn
// ========================================

router.put("/:nisn", async (req, res) => {
  try {
    const { nisn } = req.params;

    const { nama_siswa, alamat, tempat_lahir, tanggal_lahir, jurusan } =
      req.body || {};

    const pelaku = ambilPelaku(req, "updated_by");

    if (!validasiNISN(nisn)) {
      return res.status(400).json({
        status: "error",
        message: "NISN harus terdiri dari 6 angka.",
      });
    }

    if (typeof nama_siswa !== "string" || nama_siswa.trim() === "") {
      return res.status(400).json({
        status: "error",
        message: "Nama siswa wajib diisi.",
      });
    }

    const siswa = await denganTransaksi(async (client) => {
      const result = await client.query(
        `UPDATE siswa SET
          nama_siswa = $1,
          alamat = $2,
          tempat_lahir = $3,
          tanggal_lahir = $4,
          jurusan = $5,
          updated_by = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE nisn = $7
          AND deleted_at IS NULL
        RETURNING *`,
        [
          nama_siswa.trim(),
          alamat || null,
          tempat_lahir || null,
          tanggal_lahir || null,
          jurusan || null,
          pelaku,
          nisn,
        ],
      );

      if (result.rowCount === 0) {
        return null;
      }

      const data = result.rows[0];

      await catatAktivitas(
        client,
        data,
        "EDIT",
        pelaku,
        "Mengubah data siswa.",
      );

      return data;
    });

    if (!siswa) {
      return res.status(404).json({
        status: "error",
        message: "Data siswa aktif tidak ditemukan.",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Data siswa berhasil diperbarui.",
      data: siswa,
    });
  } catch (error) {
    tanganiError(res, error);
  }
});

// ========================================
// 11. SOFT DELETE - PINDAHKAN KE SAMPAH
// DELETE /api/siswa/:nisn
// ========================================

router.delete("/:nisn", async (req, res) => {
  try {
    const { nisn } = req.params;

    const pelaku = ambilPelaku(req, "deleted_by");

    if (!validasiNISN(nisn)) {
      return res.status(400).json({
        status: "error",
        message: "NISN harus terdiri dari 6 angka.",
      });
    }

    const siswa = await denganTransaksi(async (client) => {
      const result = await client.query(
        `UPDATE siswa
         SET deleted_at = CURRENT_TIMESTAMP,
             deleted_by = $1
         WHERE nisn = $2
           AND deleted_at IS NULL
         RETURNING *`,
        [pelaku, nisn],
      );

      if (result.rowCount === 0) {
        return null;
      }

      const data = result.rows[0];

      await catatAktivitas(
        client,
        data,
        "HAPUS",
        pelaku,
        "Data siswa dipindahkan ke tempat sampah.",
      );

      return data;
    });

    if (!siswa) {
      return res.status(404).json({
        status: "error",
        message: "Data siswa aktif tidak ditemukan.",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Data siswa dipindahkan ke tempat sampah.",
      data: siswa,
    });
  } catch (error) {
    tanganiError(res, error);
  }
});

// ========================================
// 12. HARD DELETE - HAPUS PERMANEN
// DELETE /api/siswa/permanen/:nisn
// ========================================

router.delete("/permanen/:nisn", async (req, res) => {
  try {
    const { nisn } = req.params;

    const pelaku =
      ambilPelaku(req, "deleted_by") || ambilPelaku(req, "dilakukan_oleh");

    if (!validasiNISN(nisn)) {
      return res.status(400).json({
        status: "error",
        message: "NISN harus terdiri dari 6 angka.",
      });
    }

    const siswa = await denganTransaksi(async (client) => {
      // Ambil data siswa dari tempat sampah
      // FOR UPDATE mencegah perubahan bersamaan
      const ditemukan = await client.query(
        `SELECT *
         FROM siswa
         WHERE nisn = $1
           AND deleted_at IS NOT NULL
         FOR UPDATE`,
        [nisn],
      );

      if (ditemukan.rowCount === 0) {
        return null;
      }

      const data = ditemukan.rows[0];

      // Catat riwayat sebelum menghapus data
      await catatAktivitas(
        client,
        data,
        "HAPUS",
        pelaku,
        "Data siswa dihapus permanen dari database.",
      );

      // Hapus permanen dari tabel siswa
      await client.query(
        `DELETE FROM siswa
         WHERE nisn = $1
           AND deleted_at IS NOT NULL`,
        [nisn],
      );

      return data;
    });

    if (!siswa) {
      return res.status(404).json({
        status: "error",
        message: "Data siswa di tempat sampah tidak ditemukan.",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Data siswa berhasil dihapus permanen.",
      data: {
        nisn: siswa.nisn,
        nama_siswa: siswa.nama_siswa,
      },
    });
  } catch (error) {
    tanganiError(res, error);
  }
});

// ========================================
// 13. EXPORT ROUTER
// ========================================

module.exports = router;
