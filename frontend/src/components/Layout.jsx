import { NavLink } from "react-router-dom";
import { Radio, CalendarDays, Users, MapPin } from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", testId: "nav-dashboard" },
  { to: "/calendrier", label: "Calendrier", icon: CalendarDays, testId: "nav-calendar" },
  { to: "/artistes", label: "Artistes", icon: Users, testId: "nav-artists" },
  { to: "/lieux", label: "Lieux", icon: MapPin, testId: "nav-venues" },
];

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col relative z-10">
      <header
        className="border-b border-zinc-800 bg-[#0A0A0C]/80 backdrop-blur sticky top-0 z-50 electron-drag"
        data-testid="main-header"
      >
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 h-16 flex items-center justify-between gap-6 electron-no-drag" style={{ paddingLeft: "80px" }}>
          <NavLink to="/dashboard" className="flex items-center gap-3 group shrink-0" data-testid="brand-link">
            <div className="w-8 h-8 bg-[#FF5A00] flex items-center justify-center group-hover:rotate-3 transition-transform">
              <Radio className="w-4 h-4 text-black" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display font-black text-base tracking-tighter">L'AMPLI</span>
              <span className="label-mono text-[10px] hidden sm:inline">Booking · Résidences · Live</span>
            </div>
          </NavLink>

          <nav className="flex items-center gap-0 overflow-x-auto -mr-4 md:mr-0">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  data-testid={n.testId}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 md:px-4 py-2 text-[11px] md:text-xs font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${
                      isActive
                        ? "text-white border-b-2 border-[#FF5A00]"
                        : "text-zinc-400 hover:text-white border-b-2 border-transparent"
                    }`
                  }
                >
                  {Icon && <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                  {n.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-zinc-800 mt-16">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-6 flex items-center justify-between">
          <div className="label-mono">© {new Date().getFullYear()} L'Ampli</div>
          <div className="label-mono">Planificateur d'événements</div>
        </div>
      </footer>
    </div>
  );
}
