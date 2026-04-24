import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ArtistsTab from "@/components/tabs/ArtistsTab";
import VenuesTab from "@/components/tabs/VenuesTab";
import EventsTab from "@/components/tabs/EventsTab";
import ResidencesTab from "@/components/tabs/ResidencesTab";
import { Users, MapPin, Ticket, Palette, TrendingUp } from "lucide-react";

const TABS = [
  { id: "events", label: "Événements", icon: Ticket },
  { id: "residences", label: "Résidences", icon: Palette },
  { id: "artists", label: "Artistes", icon: Users },
  { id: "venues", label: "Lieux", icon: MapPin },
];

export default function Dashboard() {
  const [active, setActive] = useState("events");
  const [stats, setStats] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadStats = () => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  };

  useEffect(() => {
    loadStats();
  }, [refreshKey]);

  const bumpRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-10 fade-up">
      {/* Hero header */}
      <div className="flex items-end justify-between flex-wrap gap-6 mb-10">
        <div>
          <div className="label-mono mb-3">Poste de régie · {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95]">
            La scène,
            <br />
            <span className="text-[#FF5A00]">orchestrée.</span>
          </h1>
          <p className="mt-4 text-zinc-400 max-w-xl text-base leading-relaxed">
            Programmez concerts, spectacles et résidences d'artistes. Stockez affiches, fiches techniques et contrats. Tout, au même endroit.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs label-mono">
          <TrendingUp className="w-4 h-4 text-[#FF5A00]" />
          Vue d'ensemble en direct
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 mb-10 border border-zinc-800 bg-[#121215]" data-testid="stats-bar">
        <StatCell label="Événements" value={stats?.total_events ?? "—"} />
        <StatCell label="À venir" value={stats?.upcoming_events ?? "—"} />
        <StatCell label="Confirmés" value={stats?.confirmed ?? "—"} />
        <StatCell label="Résidences" value={stats?.residencies ?? "—"} />
        <StatCell label="Artistes" value={stats?.artists ?? "—"} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 mb-8 overflow-x-auto" data-testid="tabs-bar">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              data-testid={`tab-${t.id}`}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${
                isActive
                  ? "text-white border-b-2 border-[#FF5A00] -mb-px"
                  : "text-zinc-500 hover:text-zinc-200 border-b-2 border-transparent -mb-px"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-[400px]">
        {active === "events" && <EventsTab onMutate={bumpRefresh} />}
        {active === "residences" && <ResidencesTab onMutate={bumpRefresh} />}
        {active === "artists" && <ArtistsTab onMutate={bumpRefresh} />}
        {active === "venues" && <VenuesTab onMutate={bumpRefresh} />}
      </div>
    </div>
  );
}

function StatCell({ label, value }) {
  return (
    <div className="p-5 border-r border-zinc-800 last:border-r-0">
      <div className="label-mono mb-2">{label}</div>
      <div className="font-mono text-2xl font-medium text-white tabular-nums">{value}</div>
    </div>
  );
}
