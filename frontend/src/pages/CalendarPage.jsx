import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const TYPE_BG = { concert: "bg-[#FF5A00]", spectacle: "bg-[#FACC15] text-black", residence: "bg-[#38BDF8] text-black" };
const TYPE_LABEL = { concert: "Concert", spectacle: "Spectacle", residence: "Résidence" };

export default function CalendarPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    api.get("/events").then((r) => setEvents(r.data));
    api.get("/venues").then((r) => setVenues(r.data));
  }, []);

  const venueById = useMemo(() => Object.fromEntries(venues.map((v) => [v.id, v])), [venues]);

  // Build days grid — Monday-first
  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const firstDow = (first.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const arr = [];
    for (let i = firstDow - 1; i >= 0; i--) {
      arr.push({ date: new Date(year, month - 1, prevDays - i), out: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ date: new Date(year, month, d), out: false });
    }
    while (arr.length % 7 !== 0 || arr.length < 42) {
      const last = arr[arr.length - 1].date;
      const next = new Date(last);
      next.setDate(last.getDate() + 1);
      arr.push({ date: next, out: next.getMonth() !== month });
      if (arr.length >= 42) break;
    }
    return arr;
  }, [cursor]);

  const eventsForDay = (date) => {
    const ymd = (d) => d.toISOString().slice(0, 10);
    const target = ymd(date);
    return events.filter((e) => {
      if (!e.start_date) return false;
      const s = e.start_date.slice(0, 10);
      const end = (e.end_date || e.start_date).slice(0, 10);
      return target >= s && target <= end;
    });
  };

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const goPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goToday = () => {
    const t = new Date();
    setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
    setSelectedDate(t);
  };

  const selectedEvents = selectedDate ? eventsForDay(selectedDate) : [];

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-10 fade-up">
      <div className="flex items-end justify-between flex-wrap gap-6 mb-8">
        <div>
          <div className="label-mono mb-3">Vue d'ensemble · programmation</div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95]">
            {MONTHS[cursor.getMonth()]}{" "}
            <span className="text-[#FF5A00] font-mono font-medium text-4xl sm:text-5xl">{cursor.getFullYear()}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2" data-testid="calendar-controls">
          <Button onClick={goToday} className="rounded-none bg-transparent border border-zinc-800 hover:bg-[#1C1C21] text-white text-xs font-bold uppercase tracking-widest" data-testid="cal-today">
            Aujourd'hui
          </Button>
          <Button onClick={goPrev} className="rounded-none bg-transparent border border-zinc-800 hover:bg-[#1C1C21] text-white p-2" data-testid="cal-prev">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button onClick={goNext} className="rounded-none bg-transparent border border-zinc-800 hover:bg-[#1C1C21] text-white p-2" data-testid="cal-next">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-4" data-testid="calendar-legend">
        <div className="flex items-center gap-2 label-mono"><span className="w-3 h-3 bg-[#FF5A00]" /> Concert</div>
        <div className="flex items-center gap-2 label-mono"><span className="w-3 h-3 bg-[#FACC15]" /> Spectacle</div>
        <div className="flex items-center gap-2 label-mono"><span className="w-3 h-3 bg-[#38BDF8]" /> Résidence</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="border border-zinc-800 bg-[#121215]" data-testid="calendar-grid">
          <div className="grid grid-cols-7 border-b border-zinc-800">
            {WEEKDAYS.map((d) => (
              <div key={d} className="p-3 label-mono text-center border-r border-zinc-800 last:border-r-0">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map(({ date, out }, i) => {
              const evs = eventsForDay(date);
              const isToday = isSameDay(date, today);
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(date)}
                  data-testid={`cal-day-${date.toISOString().slice(0, 10)}`}
                  className={`cal-day text-left ${out ? "out" : ""} ${isToday ? "today" : ""} ${isSelected ? "bg-[#17171c]" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`font-mono tabular-nums text-sm ${out ? "text-zinc-600" : isToday ? "text-[#FF5A00] font-bold" : "text-zinc-300"}`}>
                      {String(date.getDate()).padStart(2, "0")}
                    </span>
                    {evs.length > 0 && <span className="label-mono text-[9px]">{evs.length}</span>}
                  </div>
                  <div className="space-y-1">
                    {evs.slice(0, 3).map((e) => (
                      <div key={e.id} className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 truncate ${TYPE_BG[e.type]}`}>
                        {e.title}
                      </div>
                    ))}
                    {evs.length > 3 && <div className="label-mono text-[9px]">+{evs.length - 3}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <aside className="border border-zinc-800 bg-[#121215] p-5 h-fit sticky top-24" data-testid="calendar-side">
          <div className="label-mono mb-2">
            {selectedDate
              ? selectedDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
              : "Sélectionnez un jour"}
          </div>
          {!selectedDate ? (
            <p className="text-sm text-zinc-500">Cliquez sur une date pour voir les événements programmés.</p>
          ) : selectedEvents.length === 0 ? (
            <p className="text-sm text-zinc-500 border border-dashed border-zinc-800 p-6 text-center">
              Aucun événement ce jour
            </p>
          ) : (
            <ul className="space-y-3">
              {selectedEvents.map((e) => (
                <li key={e.id} className="border border-zinc-800 p-3 bg-[#0A0A0C]" data-testid={`side-event-${e.id}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Circle className={`w-2 h-2 ${TYPE_BG[e.type].split(" ")[0]}`} fill="currentColor" />
                    <span className="label-mono">{TYPE_LABEL[e.type]}</span>
                  </div>
                  <div className="font-display font-bold">{e.title}</div>
                  {venueById[e.venue_id] && (
                    <div className="text-xs text-zinc-400 mt-1">{venueById[e.venue_id].name}</div>
                  )}
                  {e.fee ? (
                    <div className="font-mono tabular-nums text-xs mt-1 text-zinc-400">
                      {new Intl.NumberFormat("fr-FR", { style: "currency", currency: e.currency || "EUR", maximumFractionDigits: 0 }).format(e.fee)}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
