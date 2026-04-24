import { useState } from "react";
import EventsTab from "@/components/tabs/EventsTab";

export default function Dashboard() {
  const [, setRefreshKey] = useState(0);
  const bumpRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-10 fade-up">
      <div className="mb-8">
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95]">
          Planificateur <span className="text-[#FF5A00]">d'événements</span>
        </h1>
      </div>
      <EventsTab onMutate={bumpRefresh} />
    </div>
  );
}
