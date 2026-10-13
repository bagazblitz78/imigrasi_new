// Minimal i18n layer. Indonesian is the primary (and currently only) locale.
// Text lives here (or in the per-feature components) rather than in business
// logic, so additional locales can be added later without refactoring.

const id = {
  app: {
    name: "Sistem Imigrasi",
    fullName: "Sistem Informasi Imigrasi Bandara",
    tagline: "Bandara Internasional",
  },
  common: {
    loading: "Memuat…",
    retry: "Coba lagi",
    refresh: "Muat ulang",
    cancel: "Batal",
    confirm: "Konfirmasi",
    save: "Simpan",
    search: "Cari",
    close: "Tutup",
    yes: "Ya",
    no: "Tidak",
    all: "Semua",
    noData: "Belum ada data",
    errorTitle: "Terjadi kesalahan",
  },
  auth: {
    title: "Masuk ke Sistem",
    username: "Username",
    password: "Password",
    submit: "Masuk",
    submitting: "Memverifikasi…",
    sessionNote: "Sesi otomatis berakhir setelah tidak ada aktivitas.",
    showPassword: "Tampilkan",
    hidePassword: "Sembunyikan",
  },
};

export const messages = { id };

export function t(key, locale = "id") {
  return key.split(".").reduce((acc, part) => acc?.[part], messages[locale]) ?? key;
}
