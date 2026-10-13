import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="state" style={{ minHeight: "60vh" }}>
      <div className="state__icon" aria-hidden="true">🧭</div>
      <div className="state__title">Halaman tidak ditemukan</div>
      <p className="state__text">Tautan yang Anda buka tidak tersedia atau telah dipindahkan.</p>
      <Link className="btn btn--secondary" to="/">
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
