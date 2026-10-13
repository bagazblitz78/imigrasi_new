import { NavLink } from "react-router-dom";

import { RoleBadge } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { navItemsForRole } from "./navConfig";
import { maskName } from "../utils/format";

export function Sidebar({ collapsed, mobileOpen, onNavigate, badges = {} }) {
  const { user } = useAuth();
  const items = navItemsForRole(user.role);
  const sections = [...new Set(items.map((i) => i.section))];

  return (
    <aside
      className={[
        "sidebar",
        collapsed ? "sidebar--collapsed" : "",
        mobileOpen ? "is-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Navigasi utama"
    >
      <div className="sidebar__brand">
        <div className="sidebar__brand-mark" aria-hidden="true">
          🛂
        </div>
        <div className="sidebar__brand-text">
          <strong>IMIGRASI</strong>
          <span>SISTEM INFORMASI</span>
        </div>
      </div>

      <div className="sidebar__user">
        <div className="sidebar__user-name">{user.full_name}</div>
        <div style={{ marginTop: 6 }}>
          <RoleBadge role={user.role} />
        </div>
      </div>

      <nav className="sidebar__nav">
        {sections.map((section) => (
          <div key={section}>
            <div className="sidebar__section">{section}</div>
            {items
              .filter((i) => i.section === section)
              .map((item) => {
                const badge = item.badgeKey ? badges[item.badgeKey] : 0;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}
                    onClick={onNavigate}
                    title={item.label}
                  >
                    <span className="nav-link__icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="nav-link__label">{item.label}</span>
                    {badge > 0 && <span className="nav-link__badge">{badge}</span>}
                  </NavLink>
                );
              })}
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__user-name" style={{ fontSize: 11, color: "#94a3b8" }}>
          {collapsed ? "" : `Petugas: ${maskName(user.full_name)}`}
        </div>
      </div>
    </aside>
  );
}
