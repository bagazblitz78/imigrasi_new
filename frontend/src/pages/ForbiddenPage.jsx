import { Link } from "react-router-dom";

export default function ForbiddenPage() {
  return (
    <div className="state" style={{ minHeight: "50vh" }}>
      <div className="state__icon" aria-hidden="true">🔒</div>
      <div className="state__title">Akses ditolak</div>
      <p className="state__text">Anda tidak memiliki kewenangan untuk mengakses halaman ini.</p>
      <Link className="btn btn--secondary" to="/">
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
