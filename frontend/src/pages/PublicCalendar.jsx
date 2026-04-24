import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api, API, openRoadmap } from "@/lib/api";
import { ChevronLeft, ChevronRight, Circle, FileDown, MapPin, Users, Radio, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const WEEKDAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const WEEKDAYS_LONG = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const TYPE_BG = {
  concert: "bg-[#FF5A00]",
  spectacle: "bg-[#FACC15] text-black",
  residence: "bg-[#38BDF8] text-black",
};
const TYPE_DOT = { concert: "#FF5A00", spectacle: "#FACC15", residence: "#38BDF8" };
const TYPE_LABEL = { concert: "Concert", spectacle: "Spectacle", residence: "Résidence" };
const STATUS_LABEL = { confirmed: "Confirmé", option: "Option", cancelled: "Annulé" };

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseYMD = (s) => {
  if (!s) return null;
  const [y, m, day] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day);
};
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const startOfWeek = (d) => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (r.getDay() + 6) % 7;
  return addDays(r, -dow);
};

export default function PublicCalendar() {
  const { token } = useParams();
  const today = new Date();
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today);

  useEffect(() => {
    api.get(`/public/${token}/calendar`)
      .then((r) => setData(r.data))
      .catch(() => setError("Lien public invalide ou expiré"));
  }, [token]);

  const events = data?.events || [];
  const venueById = useMemo(() => Object.fromEntries((data?.venues || []).map((v) => [v.id, v])), [data]);
  const artistById = useMemo(() => Object.fromEntries((data?.artists || []).map((a) => [a.id, a])), [data]);

  const eventsForDay = (date) => {
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

  const headerTitle = useMemo(() => {
    if (view === "month" || view === "agenda") return { main: MONTHS[cursor.getMonth()], sub: cursor.getFullYear() };
    if (view === "week") {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      const sameMonth = s.getMonth() === e.getMonth();
      return sameMonth
        ? { main: `${s.getDate()} – ${e.getDate()} ${MONTHS[e.getMonth()]}`, sub: e.getFullYear() }
        : { main: `${s.getDate()} ${MONTHS[s.getMonth()].slice(0,3)}. – ${e.getDate()} ${MONTHS[e.getMonth()].slice(0,3)}.`, sub: e.getFullYear() };
    }
    return { main: `${cursor.getDate()} ${MONTHS[cursor.getMonth()]}`, sub: cursor.getFullYear() };
  }, [view, cursor]);

  const navigate = (dir) => {
    if (view === "month" || view === "agenda") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
    else if (view === "week") setCursor(addDays(cursor, dir * 7));
    else { const n = addDays(cursor, dir); setCursor(n); setSelectedDate(n); }
  };

  const goToday = () => {
    const t = new Date();
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    setCursor(d); setSelectedDate(d);
  };

  const icsHref = useMemo(() => {
    let s, e;
    if (view === "week") { s = startOfWeek(cursor); e = addDays(s, 6); }
    else if (view === "day") { s = cursor; e = cursor; }
    else { s = new Date(cursor.getFullYear(), cursor.getMonth(), 1); e = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0); }
    return `${API}/export/events.ics?start=${ymd(s)}&end=${ymd(e)}`;
  }, [view, cursor]);

  const handleRoadmap = (eid) => openRoadmap(eid, `/public/${token}/events/${eid}/roadmap.pdf`);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0C] text-white">
        <div className="text-center p-10 border border-zinc-800 bg-[#121215] max-w-md">
          <AlertCircle className="w-10 h-10 mx-auto text-[#FF5A00] mb-3" />
          <h1 className="font-display text-2xl font-bold">{error}</h1>
          <p className="text-sm text-zinc-500 mt-2">Demandez à la régie un nouveau lien.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0C] text-white">
        <div className="label-mono">Chargement…</div>
      </div>
    );
  }

  const selectedEvents = selectedDate ? eventsForDay(selectedDate) : [];

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white grain">
      <header className="border-b border-zinc-800 bg-[#0A0A0C]/80 backdrop-blur sticky top-0 z-50" data-testid="public-header">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#FF5A00] flex items-center justify-center">
              <Radio className="w-4 h-4 text-black" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display font-black text-base tracking-tighter">L'AMPLI</span>
              <span className="label-mono text-[10px] hidden sm:inline">Planning public · lecture seule</span>
            </div>
          </div>
          <div className="label-mono text-[10px] md:text-xs text-zinc-500">
            {events.length} événement{events.length !== 1 ? "s" : ""}
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 md:px-12 py-10 fade-up relative z-10">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-8">
          <div>
            <div className="label-mono mb-3">Programmation L'Ampli</div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95]">
              {headerTitle.main}{" "}
              <span className="text-[#FF5A00] font-mono font-medium text-4xl sm:text-5xl">{headerTitle.sub}</span>
            </h1>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center border border-zinc-800" data-testid="public-view-switcher">
              {[
                { id: "month", label: "Mois" },
                { id: "week", label: "Semaine" },
                { id: "day", label: "Jour" },
                { id: "agenda", label: "Agenda" },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  data-testid={`public-view-${v.id}`}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                    view === v.id ? "bg-[#FF5A00] text-white" : "bg-transparent text-zinc-400 hover:text-white"
                  }`}
                >{v.label}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={goToday} className="rounded-none bg-transparent border border-zinc-800 hover:bg-[#1C1C21] text-white text-xs font-bold uppercase tracking-widest">Aujourd'hui</Button>
              <Button onClick={() => navigate(-1)} className="rounded-none bg-transparent border border-zinc-800 hover:bg-[#1C1C21] text-white p-2"><ChevronLeft className="w-4 h-4" /></Button>
              <Button onClick={() => navigate(1)} className="rounded-none bg-transparent border border-zinc-800 hover:bg-[#1C1C21] text-white p-2"><ChevronRight className="w-4 h-4" /></Button>
            </div>
            <a href={icsHref} className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-800 hover:border-[#FF5A00] hover:text-[#FF5A00] text-xs font-bold uppercase tracking-widest text-white">.ics</a>
          </div>
        </div>

        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-2 label-mono"><span className="w-3 h-3 bg-[#FF5A00]" /> Concert</div>
          <div className="flex items-center gap-2 label-mono"><span className="w-3 h-3 bg-[#FACC15]" /> Spectacle</div>
          <div className="flex items-center gap-2 label-mono"><span className="w-3 h-3 bg-[#38BDF8]" /> Résidence</div>
        </div>

        {view === "agenda" ? (
          <AgendaRO cursor={cursor} events={events} venueById={venueById} artistById={artistById} onRoadmap={handleRoadmap} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <div>
              {view === "month" && <MonthRO cursor={cursor} today={today} selectedDate={selectedDate} setSelectedDate={setSelectedDate} eventsForDay={eventsForDay} isSameDay={isSameDay} />}
              {view === "week" && <WeekRO cursor={cursor} today={today} selectedDate={selectedDate} setSelectedDate={setSelectedDate} eventsForDay={eventsForDay} isSameDay={isSameDay} />}
              {view === "day" && <DayRO date={cursor} events={eventsForDay(cursor)} venueById={venueById} artistById={artistById} onRoadmap={handleRoadmap} />}
            </div>
            <aside className="border border-zinc-800 bg-[#121215] p-5 h-fit lg:sticky lg:top-24">
              <div className="label-mono mb-2">
                {selectedDate?.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </div>
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-zinc-500 border border-dashed border-zinc-800 p-6 text-center">Aucun événement ce jour</p>
              ) : (
                <ul className="space-y-3">
                  {selectedEvents.map((e) => (
                    <li key={e.id} className="border border-zinc-800 p-3 bg-[#0A0A0C]">
                      <div className="flex items-center gap-2 mb-1">
                        <Circle className="w-2 h-2" fill={TYPE_DOT[e.type]} color={TYPE_DOT[e.type]} />
                        <span className="label-mono">{TYPE_LABEL[e.type]}</span>
                        <span className="label-mono text-zinc-500">· {STATUS_LABEL[e.status]}</span>
                      </div>
                      <div className="font-display font-bold">{e.title}</div>
                      {venueById[e.venue_id] && <div className="flex items-center gap-1 text-xs text-zinc-400 mt-1"><MapPin className="w-3 h-3" />{venueById[e.venue_id].name}</div>}
                      {e.artist_ids?.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-zinc-400 mt-1">
                          <Users className="w-3 h-3" />
                          {e.artist_ids.map((id) => artistById[id]?.name).filter(Boolean).join(", ")}
                        </div>
                      )}
                      <button type="button" onClick={() => handleRoadmap(e.id)} className="mt-2 inline-flex items-center gap-1 text-xs text-[#FF5A00] hover:underline">
                        <FileDown className="w-3 h-3" /> Feuille de route PDF
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-800 mt-16">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-6 flex items-center justify-between">
          <div className="label-mono">© {new Date().getFullYear()} L'Ampli</div>
          <div className="label-mono">Vue publique · lecture seule</div>
        </div>
      </footer>
    </div>
  );
}

function ChipRO({ ev, compact = false }) {
  return (
    <div className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 truncate ${TYPE_BG[ev.type]} ${compact ? "" : "mb-1"}`}>
      {ev.title}
    </div>
  );
}

function MonthRO({ cursor, today, selectedDate, setSelectedDate, eventsForDay, isSameDay }) {
  const days = useMemo(() => {
    const year = cursor.getFullYear(); const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const firstDow = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const arr = [];
    for (let i = firstDow - 1; i >= 0; i--) arr.push({ date: new Date(year, month - 1, prevDays - i), out: true });
    for (let d = 1; d <= daysInMonth; d++) arr.push({ date: new Date(year, month, d), out: false });
    while (arr.length < 42) { const last = arr[arr.length - 1].date; const next = addDays(last, 1); arr.push({ date: next, out: next.getMonth() !== month }); }
    return arr;
  }, [cursor]);

  return (
    <div className="border border-zinc-800 bg-[#121215]">
      <div className="grid grid-cols-7 border-b border-zinc-800">
        {WEEKDAYS_SHORT.map((d) => <div key={d} className="p-3 label-mono text-center border-r border-zinc-800 last:border-r-0">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map(({ date, out }, i) => {
          const evs = eventsForDay(date);
          const isToday = isSameDay(date, today);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          return (
            <div key={i} onClick={() => setSelectedDate(date)}
              className={`cal-day text-left cursor-pointer ${out ? "out" : ""} ${isToday ? "today" : ""} ${isSelected ? "bg-[#17171c]" : ""}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`font-mono tabular-nums text-sm ${out ? "text-zinc-600" : isToday ? "text-[#FF5A00] font-bold" : "text-zinc-300"}`}>
                  {String(date.getDate()).padStart(2, "0")}
                </span>
                {evs.length > 0 && <span className="label-mono text-[9px]">{evs.length}</span>}
              </div>
              <div className="space-y-1">
                {evs.slice(0, 3).map((ev) => <ChipRO key={ev.id} ev={ev} compact />)}
                {evs.length > 3 && <div className="label-mono text-[9px]">+{evs.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekRO({ cursor, today, selectedDate, setSelectedDate, eventsForDay, isSameDay }) {
  const start = startOfWeek(cursor);
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(start, i));
  return (
    <div className="border border-zinc-800 bg-[#121215]">
      <div className="grid grid-cols-7 border-b border-zinc-800">
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={i} className={`p-3 border-r border-zinc-800 last:border-r-0 ${isToday ? "bg-[#1C1C21]" : ""}`}>
              <div className="label-mono">{WEEKDAYS_SHORT[i]}</div>
              <div className={`font-mono tabular-nums text-xl ${isToday ? "text-[#FF5A00] font-bold" : "text-white"}`}>{String(d.getDate()).padStart(2, "0")}</div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7 min-h-[400px]">
        {days.map((d, i) => {
          const evs = eventsForDay(d);
          const isSelected = selectedDate && isSameDay(d, selectedDate);
          return (
            <div key={i} onClick={() => setSelectedDate(d)} className={`p-3 border-r border-zinc-800 last:border-r-0 cursor-pointer min-h-[400px] ${isSelected ? "bg-[#17171c]" : "hover:bg-[#15151a]"}`}>
              <div className="space-y-1.5">
                {evs.length === 0 && <div className="label-mono text-[9px]">—</div>}
                {evs.map((ev) => <ChipRO key={ev.id} ev={ev} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayRO({ date, events, venueById, artistById, onRoadmap }) {
  const dow = (date.getDay() + 6) % 7;
  return (
    <div className="border border-zinc-800 bg-[#121215]">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-baseline justify-between">
        <div>
          <div className="label-mono">{WEEKDAYS_LONG[dow]}</div>
          <div className="font-display text-3xl font-black tracking-tighter">{String(date.getDate()).padStart(2, "0")} {MONTHS[date.getMonth()]}</div>
        </div>
        <div className="label-mono">{events.length} événement{events.length !== 1 ? "s" : ""}</div>
      </div>
      {events.length === 0 ? (
        <div className="p-12 text-center">
          <div className="font-display text-xl font-bold">Journée libre</div>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {events.map((e) => (
            <li key={e.id} className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2" style={{ background: TYPE_DOT[e.type] }} />
                    <span className="label-mono">{TYPE_LABEL[e.type]}</span>
                    <span className="label-mono text-zinc-500">· {STATUS_LABEL[e.status]}</span>
                  </div>
                  <div className="font-display text-xl font-bold">{e.title}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-zinc-400">
                    {venueById[e.venue_id] && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{venueById[e.venue_id].name}</span>}
                    {e.artist_ids?.length > 0 && <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{e.artist_ids.map((id) => artistById[id]?.name).filter(Boolean).join(", ")}</span>}
                  </div>
                </div>
                <button onClick={() => onRoadmap(e.id)} className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-800 hover:border-[#FF5A00] hover:text-[#FF5A00] text-xs font-bold uppercase tracking-widest">
                  <FileDown className="w-4 h-4" /> Feuille de route
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AgendaRO({ cursor, events, venueById, artistById, onRoadmap }) {
  const { monthEvents, monthStart, monthEnd } = useMemo(() => {
    const s = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const e = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const sKey = ymd(s), eKey = ymd(e);
    const filtered = events
      .filter((ev) => {
        const start = (ev.start_date || "").slice(0, 10);
        const end = (ev.end_date || ev.start_date || "").slice(0, 10);
        return end >= sKey && start <= eKey;
      })
      .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
    return { monthEvents: filtered, monthStart: s, monthEnd: e };
  }, [cursor, events]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const e of monthEvents) {
      let k = (e.start_date || "").slice(0, 10);
      const mStartKey = ymd(monthStart);
      if (k < mStartKey) k = mStartKey;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [monthEvents, monthStart]);

  return (
    <div className="border border-zinc-800 bg-[#121215]">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <div className="label-mono">Liste · {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</div>
          <div className="font-display text-2xl font-bold">{monthEvents.length} événement{monthEvents.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="label-mono">{ymd(monthStart)} → {ymd(monthEnd)}</div>
      </div>
      {monthEvents.length === 0 ? (
        <div className="p-12 text-center">
          <div className="font-display text-xl font-bold">Aucun événement ce mois-ci</div>
        </div>
      ) : (
        <ul>
          {groups.map(([dayKey, evs]) => {
            const d = parseYMD(dayKey);
            const dow = d ? (d.getDay() + 6) % 7 : 0;
            return (
              <li key={dayKey} className="grid grid-cols-1 md:grid-cols-[180px_1fr] border-b border-zinc-800 last:border-b-0">
                <div className="px-5 py-4 border-b md:border-b-0 md:border-r border-zinc-800 bg-[#0F0F12]">
                  <div className="label-mono">{d ? WEEKDAYS_LONG[dow] : ""}</div>
                  <div className="font-display text-2xl font-black tracking-tighter leading-none mt-1">{d ? String(d.getDate()).padStart(2, "0") : dayKey}</div>
                  <div className="label-mono text-zinc-500 mt-1">{d ? MONTHS[d.getMonth()] : ""}</div>
                </div>
                <ul className="divide-y divide-zinc-800">
                  {evs.map((e) => (
                    <li key={e.id} className="p-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2" style={{ background: TYPE_DOT[e.type] }} />
                            <span className="label-mono">{TYPE_LABEL[e.type]}</span>
                            <span className="label-mono text-zinc-500">· {STATUS_LABEL[e.status]}</span>
                          </div>
                          <div className="font-display text-lg font-bold">{e.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                            {venueById[e.venue_id] && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{venueById[e.venue_id].name}</span>}
                            {e.artist_ids?.length > 0 && <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{e.artist_ids.map((id) => artistById[id]?.name).filter(Boolean).join(", ")}</span>}
                          </div>
                        </div>
                        <button onClick={() => onRoadmap(e.id)} className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[#FF5A00] hover:underline">
                          <FileDown className="w-3 h-3" /> Feuille de route
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
