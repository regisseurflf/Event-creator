import { NavLink, useLocation } from "react-router-dom";
import { Radio, CalendarDays } from "lucide-react";

export default function Layout({ children }) {
  const location = useLocation();
  return (
    <div className="min-h-screen flex flex-col relative z-10">
      <header
        className="border-b border-zinc-800 bg-[#0A0A0C]/80 backdrop-blur sticky top-0 z-50"
        data-testid="main-header"
      >
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
          <NavLink to="/dashboard" className="flex items-center gap-3 group" data-testid="brand-link">
            <div className="w-8 h-8 bg-[#FF5A00] flex items-center justify-center group-hover:rotate-3 transition-transform">
              <Radio className="w-4 h-4 text-black" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display font-black text-base tracking-tighter">SCÈNE PULSE</span>
              <span className="label-mono text-[10px]">Booking · Résidences · Live</span>
            </div>
          </NavLink>

          <nav className="flex items-center gap-1">
            <NavLink
              to="/dashboard"
              data-testid="nav-dashboard"
              className={({ isActive }) =>
                `px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                  isActive
                    ? "text-white border-b-2 border-[#FF5A00]"
                    : "text-zinc-400 hover:text-white border-b-2 border-transparent"
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/calendrier"
              data-testid="nav-calendar"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                  isActive
                    ? "text-white border-b-2 border-[#FF5A00]"
                    : "text-zinc-400 hover:text-white border-b-2 border-transparent"
                }`
              }
            >
              <CalendarDays className="w-4 h-4" />
              Calendrier
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-zinc-800 mt-16">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-6 flex items-center justify-between">
          <div className="label-mono">© {new Date().getFullYear()} Scène Pulse</div>
          <div className="label-mono">
            {location.pathname === "/calendrier" ? "CALENDRIER" : "DASHBOARD"}
          </div>
        </div>
      </footer>
    </div>
  );
}
