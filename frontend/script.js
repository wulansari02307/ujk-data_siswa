/* =====================================
   KONFIGURASI
===================================== */

const API = "/api/siswa";

let daftarSiswa = [];
let modeEdit = false;
let timerPencarian;

/* =====================================
   AMBIL ELEMEN HTML
===================================== */

function ambilTabel(id) {
  const elemen = document.getElementById(id);

  if (!elemen) {
    console.error(`Elemen dengan ID "${id}" tidak ditemukan.`);
    return null;
  }

  // Jika ID menunjuk ke <table>, gunakan tbody di dalamnya.
  if (elemen.tagName === "TABLE") {
    return elemen.querySelector("tbody") || elemen.createTBody();
  }

  return elemen;
}

const form = document.getElementById("formSiswa");
const tabel = ambilTabel("tabelSiswa");
const tabelSampah = ambilTabel("tabelSampah");
const tabelRiwayat = ambilTabel("tabelRiwayat");

const pencarian = document.getElementById("pencarian");
const totalSiswa = document.getElementById("totalSiswa");

const tombolSimpan = document.getElementById("tombolSimpan");
const tombolBatal = document.getElementById("tombolBatal");
const tombolMuatSampah = document.getElementById("tombolMuatSampah");
const tombolMuatRiwayat = document.getElementById("tombolMuatRiwayat");
const judulForm = document.getElementById("judulForm");

/* =====================================
   VALIDASI ELEMEN
===================================== */

function periksaElemen() {
  const wajib = {
    formSiswa: form,
    tabelSiswa: tabel,
    tabelSampah: tabelSampah,
    tabelRiwayat: tabelRiwayat,
    pencarian,
    totalSiswa,
    tombolSimpan,
    tombolBatal,
    tombolMuatSampah,
    tombolMuatRiwayat,
    judulForm,
  };

  const tidakAda = Object.entries(wajib)
    .filter(([, elemen]) => !elemen)
    .map(([nama]) => nama);

  if (tidakAda.length) {
    console.error("Elemen HTML tidak ditemukan:", tidakAda.join(", "));
    return false;
  }

  return true;
}

/* =====================================
   PENGAMAN TEKS
===================================== */

function aman(teks) {
  return String(teks ?? "").replace(
    /[&<>"']/g,
    (karakter) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[karakter],
  );
}

/* =====================================
   FORMAT TANGGAL
===================================== */

function formatTanggal(tanggal) {
  if (!tanggal) return "-";

  const nilai = String(tanggal).slice(0, 10);
  const bagian = nilai.split("-");

  if (bagian.length !== 3) return "-";

  return `${bagian[2]}-${bagian[1]}-${bagian[0]}`;
}

function formatWaktu(waktu) {
  if (!waktu) return "-";

  const tanggal = new Date(waktu);

  if (Number.isNaN(tanggal.getTime())) return "-";

  return tanggal.toLocaleString("id-ID");
}

/* =====================================
   REQUEST API
===================================== */

async function requestAPI(url, pilihan = {}) {
  const response = await fetch(url, pilihan);

  let hasil;

  try {
    hasil = await response.json();
  } catch {
    throw new Error("Respons server tidak valid.");
  }

  if (!response.ok) {
    throw new Error(
      hasil.message || `Terjadi kesalahan HTTP ${response.status}`,
    );
  }

  return hasil;
}

/* =====================================
   TAMPILKAN DATA SISWA
===================================== */

async function tampilkanSiswa(kata = "") {
  if (!tabel) return;

  tabel.innerHTML = `
    <tr>
      <td colspan="9">Memuat data siswa...</td>
    </tr>
  `;

  try {
    const url = `${API}?search=${encodeURIComponent(kata)}`;
    const hasil = await requestAPI(url);

    daftarSiswa = Array.isArray(hasil.data) ? hasil.data : [];

    totalSiswa.textContent = hasil.jumlah ?? daftarSiswa.length;

    renderTabel(daftarSiswa);

    console.log("Data siswa berhasil dimuat:", daftarSiswa.length);
  } catch (error) {
    console.error("Gagal mengambil data siswa:", error);

    tabel.innerHTML = `
      <tr>
        <td colspan="9">
          Gagal mengambil data: ${aman(error.message)}
        </td>
      </tr>
    `;

    totalSiswa.textContent = "0";
  }
}

/* =====================================
   RENDER TABEL SISWA
===================================== */

function renderTabel(data) {
  if (!tabel) return;

  if (!data.length) {
    tabel.innerHTML = `
      <tr>
        <td colspan="9">Data siswa tidak ditemukan.</td>
      </tr>
    `;
    return;
  }

  tabel.innerHTML = data
    .map(
      (siswa, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${aman(siswa.nisn)}</td>
      <td>${aman(siswa.nama_siswa)}</td>
      <td>
        ${aman(siswa.tempat_lahir)},
        ${formatTanggal(siswa.tanggal_lahir)}
      </td>
      <td>${aman(siswa.alamat)}</td>
      <td>${aman(siswa.jurusan)}</td>
      <td>
        ${formatWaktu(siswa.created_at)}
        <br>Oleh: ${aman(siswa.created_by)}
      </td>
      <td>
        ${formatWaktu(siswa.updated_at)}
        <br>Oleh: ${aman(siswa.updated_by)}
      </td>
      <td>
        <button class="btn-edit"
          data-aksi="edit"
          data-nisn="${aman(siswa.nisn)}">
          Edit
        </button>

        <button class="btn-delete"
          data-aksi="hapus"
          data-nisn="${aman(siswa.nisn)}">
          Hapus
        </button>
      </td>
    </tr>
  `,
    )
    .join("");
}

/* =====================================
   TAMBAH SISWA
===================================== */

async function tambahSiswa(data) {
  return requestAPI(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...data,
      created_by: "Admin",
    }),
  });
}

/* =====================================
   UPDATE SISWA
===================================== */

async function updateSiswa(data) {
  return requestAPI(`${API}/${encodeURIComponent(data.nisn)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...data,
      updated_by: "Admin",
    }),
  });
}

/* =====================================
   FORM TAMBAH DAN EDIT
===================================== */

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = {
    nisn: document.getElementById("nisn").value.trim(),
    nama_siswa: document.getElementById("nama_siswa").value.trim(),
    alamat: document.getElementById("alamat").value.trim(),
    tempat_lahir: document.getElementById("tempat_lahir").value.trim(),
    tanggal_lahir: document.getElementById("tanggal_lahir").value || null,
    jurusan: document.getElementById("jurusan").value.trim(),
  };

  if (!/^[0-9]{6}$/.test(data.nisn)) {
    alert("NISN harus terdiri dari 6 digit angka!");
    return;
  }

  if (!data.nama_siswa) {
    alert("Nama siswa wajib diisi!");
    return;
  }

  const sedangEdit = modeEdit;

  tombolSimpan.disabled = true;
  tombolSimpan.textContent = "Menyimpan...";

  try {
    const hasil = sedangEdit
      ? await updateSiswa(data)
      : await tambahSiswa(data);

    alert(hasil.message || "Data berhasil disimpan.");

    resetForm();
    await tampilkanSiswa(pencarian.value.trim());
  } catch (error) {
    alert("Gagal menyimpan data: " + error.message);
  } finally {
    tombolSimpan.disabled = false;
    tombolSimpan.textContent = modeEdit ? "Update Data" : "+ Tambah Data Siswa";
  }
});

/* =====================================
   EDIT SISWA
===================================== */

function editSiswa(nisn) {
  const siswa = daftarSiswa.find((item) => String(item.nisn) === String(nisn));

  if (!siswa) {
    alert("Data siswa tidak ditemukan!");
    return;
  }

  modeEdit = true;

  document.getElementById("nisn").value = siswa.nisn;
  document.getElementById("nisn").readOnly = true;

  document.getElementById("nama_siswa").value = siswa.nama_siswa || "";

  document.getElementById("alamat").value = siswa.alamat || "";

  document.getElementById("tempat_lahir").value = siswa.tempat_lahir || "";

  document.getElementById("tanggal_lahir").value = siswa.tanggal_lahir
    ? String(siswa.tanggal_lahir).slice(0, 10)
    : "";

  document.getElementById("jurusan").value = siswa.jurusan || "";

  judulForm.textContent = "Edit Data Siswa";
  tombolSimpan.textContent = "Update Data";
  tombolBatal.hidden = false;

  document.getElementById("panelForm")?.scrollIntoView({
    behavior: "smooth",
  });
}

/* =====================================
   HAPUS SEMENTARA
===================================== */

async function hapusSiswa(nisn) {
  const setuju = confirm(`Pindahkan siswa NISN ${nisn} ke Tempat Sampah?`);

  if (!setuju) return;

  try {
    const hasil = await requestAPI(`${API}/${encodeURIComponent(nisn)}`, {
      method: "DELETE",
    });

    alert(hasil.message || "Data dipindahkan ke sampah.");

    await tampilkanSiswa(pencarian.value.trim());
    await tampilkanSampah();
  } catch (error) {
    alert("Gagal menghapus: " + error.message);
  }
}

/* =====================================
   EVENT TABEL SISWA
===================================== */

tabel.addEventListener("click", (event) => {
  const tombol = event.target.closest("button[data-aksi]");

  if (!tombol) return;

  const nisn = tombol.dataset.nisn;

  if (tombol.dataset.aksi === "edit") {
    editSiswa(nisn);
  }

  if (tombol.dataset.aksi === "hapus") {
    hapusSiswa(nisn);
  }
});

/* =====================================
   TAMPILKAN TEMPAT SAMPAH
===================================== */

async function tampilkanSampah() {
  if (!tabelSampah) return;

  tabelSampah.innerHTML = `
    <tr><td colspan="7">Memuat tempat sampah...</td></tr>
  `;

  try {
    const hasil = await requestAPI(`${API}/sampah`);
    const data = hasil.data || [];

    if (!data.length) {
      tabelSampah.innerHTML = `
        <tr><td colspan="7">Tempat sampah masih kosong.</td></tr>
      `;
      return;
    }

    tabelSampah.innerHTML = data
      .map(
        (siswa, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${aman(siswa.nisn)}</td>
        <td>${aman(siswa.nama_siswa)}</td>
        <td>${aman(siswa.jurusan)}</td>
        <td>${formatWaktu(siswa.deleted_at)}</td>
        <td>${aman(siswa.deleted_by)}</td>
        <td>
          <button class="btn-restore"
            data-aksi-sampah="pulihkan"
            data-nisn="${aman(siswa.nisn)}">
            Pulihkan
          </button>

          <button class="btn-delete"
            data-aksi-sampah="permanen"
            data-nisn="${aman(siswa.nisn)}">
            Hapus Permanen
          </button>
        </td>
      </tr>
    `,
      )
      .join("");
  } catch (error) {
    console.error(error);

    tabelSampah.innerHTML = `
      <tr>
        <td colspan="7">Gagal memuat: ${aman(error.message)}</td>
      </tr>
    `;
  }
}

/* =====================================
   PULIHKAN SISWA
===================================== */

async function pulihkanSiswa(nisn) {
  if (!confirm(`Pulihkan siswa dengan NISN ${nisn}?`)) return;

  try {
    const hasil = await requestAPI(
      `${API}/pulihkan/${encodeURIComponent(nisn)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dilakukan_oleh: "Admin",
        }),
      },
    );

    alert(hasil.message || "Data berhasil dipulihkan.");

    await tampilkanSampah();
    await tampilkanSiswa(pencarian.value.trim());
    await tampilkanRiwayat();
  } catch (error) {
    alert("Gagal memulihkan data: " + error.message);
  }
}

/* =====================================
   HAPUS PERMANEN
===================================== */

async function hapusPermanen(nisn) {
  const setuju = confirm(
    `PERINGATAN!\n\nHapus permanen siswa NISN ${nisn}?\n\nData tidak dapat dipulihkan lagi.`,
  );

  if (!setuju) return;

  try {
    const hasil = await requestAPI(
      `${API}/permanen/${encodeURIComponent(nisn)}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deleted_by: "Admin",
        }),
      },
    );

    alert(hasil.message || "Data berhasil dihapus permanen.");

    await tampilkanSampah();
    await tampilkanSiswa(pencarian.value.trim());
    await tampilkanRiwayat();
  } catch (error) {
    alert("Gagal menghapus permanen: " + error.message);
  }
}

/* =====================================
   EVENT TABEL SAMPAH
===================================== */

tabelSampah.addEventListener("click", (event) => {
  const tombol = event.target.closest("button[data-aksi-sampah]");

  if (!tombol) return;

  const nisn = tombol.dataset.nisn;

  if (tombol.dataset.aksiSampah === "pulihkan") {
    pulihkanSiswa(nisn);
  }

  if (tombol.dataset.aksiSampah === "permanen") {
    hapusPermanen(nisn);
  }
});

/* =====================================
   TAMPILKAN RIWAYAT
===================================== */

async function tampilkanRiwayat() {
  if (!tabelRiwayat) return;

  tabelRiwayat.innerHTML = `
    <tr><td colspan="7">Memuat riwayat...</td></tr>
  `;

  try {
    const hasil = await requestAPI(`${API}/riwayat`);
    const data = hasil.data || [];

    if (!data.length) {
      tabelRiwayat.innerHTML = `
        <tr><td colspan="7">Belum ada riwayat aktivitas.</td></tr>
      `;
      return;
    }

    tabelRiwayat.innerHTML = data
      .map(
        (item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${formatWaktu(item.created_at)}</td>
        <td>${aman(item.nisn)}</td>
        <td>${aman(item.nama_siswa)}</td>
        <td>
          <span class="badge-aktivitas ${aman(
            String(item.aktivitas).toLowerCase(),
          )}">
            ${aman(item.aktivitas)}
          </span>
        </td>
        <td>${aman(item.dilakukan_oleh)}</td>
        <td>${aman(item.keterangan)}</td>
      </tr>
    `,
      )
      .join("");
  } catch (error) {
    tabelRiwayat.innerHTML = `
      <tr>
        <td colspan="7">Gagal memuat: ${aman(error.message)}</td>
      </tr>
    `;
  }
}

/* =====================================
   NAVIGASI
===================================== */

document.querySelectorAll(".nav-btn").forEach((tombol) => {
  tombol.addEventListener("click", async () => {
    const tujuan = tombol.dataset.halaman;

    document.querySelectorAll(".halaman").forEach((halaman) => {
      halaman.hidden = halaman.id !== tujuan;
    });

    document.querySelectorAll(".nav-btn").forEach((nav) => {
      nav.classList.toggle("aktif", nav === tombol);
    });

    if (tujuan === "halamanSiswa") {
      await tampilkanSiswa(pencarian.value.trim());
    }

    if (tujuan === "halamanSampah") {
      await tampilkanSampah();
    }

    if (tujuan === "halamanRiwayat") {
      await tampilkanRiwayat();
    }
  });
});

/* =====================================
   TOMBOL MUAT ULANG
===================================== */

tombolMuatSampah.addEventListener("click", tampilkanSampah);
tombolMuatRiwayat.addEventListener("click", tampilkanRiwayat);

/* =====================================
   RESET FORM
===================================== */

function resetForm() {
  form.reset();
  modeEdit = false;

  document.getElementById("nisn").readOnly = false;

  judulForm.textContent = "Tambah Data Siswa";
  tombolSimpan.textContent = "+ Tambah Data Siswa";
  tombolBatal.hidden = true;
}

tombolBatal.addEventListener("click", resetForm);

/* =====================================
   PENCARIAN
===================================== */

pencarian.addEventListener("input", () => {
  clearTimeout(timerPencarian);

  timerPencarian = setTimeout(() => {
    tampilkanSiswa(pencarian.value.trim());
  }, 300);
});

/* =====================================
   MULAI APLIKASI
===================================== */

if (periksaElemen()) {
  tampilkanSiswa();
}
