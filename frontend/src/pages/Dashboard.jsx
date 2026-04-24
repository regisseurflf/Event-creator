import { useState } from "react";
import ArtistsTab from "@/components/tabs/ArtistsTab";
import VenuesTab from "@/components/tabs/VenuesTab";
import EventsTab from "@/components/tabs/EventsTab";
import ResidencesTab from "@/components/tabs/ResidencesTab";
import { Users, MapPin, Ticket, Palette } from "lucide-react";

const TABS = [
  { id: "events", label: "Événements", icon: Ticket },
  { id: "residences", label: "Résidences", icon: Palette },
  { id: "artists", label: "Artistes", icon: Users },
  { id: "venues", label: "Lieux", icon: MapPin },
];

export default function Dashboard() {
  const [active, setActive] = useState("events");
  const [, setRefreshKey] = useState(0);
  const bumpRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-10 fade-up">
      <div className="mb-8">
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95]">
          Planificateur <span className="text-[#FF5A00]">d'événements</span>
        </h1>
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
