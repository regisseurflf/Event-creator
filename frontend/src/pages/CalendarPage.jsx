import { useEffect, useMemo, useRef, useState } from "react";
import { api, API, openRoadmap } from "@/lib/api";
import { ChevronLeft, ChevronRight, Circle, FileDown, MapPin, Users, Move, Download, List, Share2, RotateCw, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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

const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const startOfWeek = (d) => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (r.getDay() + 6) % 7;
  return addDays(r, -dow);
};

export default function CalendarPage() {
  const today = new Date();
  const [view, setView] = useState("month"); // month | week | day | agenda
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [artists, setArtists] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today);

  const load = async () => {
    const [e, v, a] = await Promise.all([
      api.get("/events"),
      api.get("/venues"),
      api.get("/artists"),
    ]);
    setEvents(e.data);
    setVenues(v.data);
    setArtists(a.data);
  };

  useEffect(() => { load(); }, []);

  const venueById = useMemo(() => Object.fromEntries(venues.map((v) => [v.id, v])), [venues]);
  const artistById = useMemo(() => Object.fromEntries(artists.map((a) => [a.id, a])), [artists]);

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
    if (view === "month" || view === "agenda") {
      return { main: MONTHS[cursor.getMonth()], sub: cursor.getFullYear() };
    }
    if (view === "week") {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      const sameMonth = s.getMonth() === e.getMonth();
      if (sameMonth) {
        return { main: `${s.getDate()} – ${e.getDate()} ${MONTHS[e.getMonth()]}`, sub: e.getFullYear() };
      }
      return {
        main: `${s.getDate()} ${MONTHS[s.getMonth()].slice(0, 3)}. – ${e.getDate()} ${MONTHS[e.getMonth()].slice(0, 3)}.`,
        sub: e.getFullYear(),
      };
    }
    return { main: `${cursor.getDate()} ${MONTHS[cursor.getMonth()]}`, sub: cursor.getFullYear() };
  }, [view, cursor]);

  const navigate = (dir) => {
    if (view === "month" || view === "agenda") {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
    } else if (view === "week") {
      setCursor(addDays(cursor, dir * 7));
    } else {
      const next = addDays(cursor, dir);
      setCursor(next);
      setSelectedDate(next);
    }
  };

  const goToday = () => {
    const t = new Date();
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    setCursor(d);
    setSelectedDate(d);
  };

  // -------- Touch & mouse compatible drag via Pointer Events --------
  const dragRef = useRef(null);

  const startDrag = (e, eventId) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const label = e.currentTarget.textContent || "Événement";
    const bg = getComputedStyle(e.currentTarget).backgroundColor;
    const color = getComputedStyle(e.currentTarget).color;

    const state = {
      id: eventId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      ghost: null,
      label, bg, color,
    };
    dragRef.current = state;

    const onMove = (ev) => {
      const s = dragRef.current;
      if (!s) return;
      const dx = ev.clientX - s.startX;
      const dy = ev.clientY - s.startY;
      if (!s.moved && Math.hypot(dx, dy) > 6) {
        s.moved = true;
        const g = document.createElement("div");
        g.textContent = s.label;
        g.style.cssText = `
          position:fixed;pointer-events:none;z-index:9999;
          background:${s.bg};color:${s.color};padding:4px 8px;
          font-family:'JetBrains Mono',monospace;font-size:10px;
          font-weight:700;letter-spacing:0.06em;text-transform:uppercase;
          box-shadow:0 8px 24px rgba(0,0,0,0.6);transform:translate(8px,8px);
          max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        `;
        document.body.appendChild(g);
        s.ghost = g;
      }
      if (s.moved && s.ghost) {
        s.ghost.style.left = ev.clientX + "px";
        s.ghost.style.top = ev.clientY + "px";
        // highlight drop target
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const cell = el && el.closest ? el.closest("[data-dropdate]") : null;
        document.querySelectorAll("[data-dropdate].drop-hot").forEach((x) => x.classList.remove("drop-hot"));
        if (cell) cell.classList.add("drop-hot");
      }
    };

    const onUp = (ev) => {
      const s = dragRef.current;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.querySelectorAll("[data-dropdate].drop-hot").forEach((x) => x.classList.remove("drop-hot"));
      if (!s) return;
      if (s.ghost) s.ghost.remove();
      dragRef.current = null;
      if (!s.moved) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const cell = el && el.closest ? el.closest("[data-dropdate]") : null;
      if (!cell) return;
      const targetYMD = cell.getAttribute("data-dropdate");
      const target = parseYMD(targetYMD);
      if (!target) return;
      moveEvent(s.id, target);
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const moveEvent = async (id, targetDate) => {
    const source = events.find((x) => x.id === id);
    if (!source) return;
    const oldStart = parseYMD(source.start_date);
    if (!oldStart) return;
    const deltaDays = Math.round((targetDate - oldStart) / 86400000);
    if (deltaDays === 0) return;
    const newStart = ymd(addDays(oldStart, deltaDays));
    let newEnd = null;
    if (source.end_date) {
      const oldEnd = parseYMD(source.end_date);
      if (oldEnd) newEnd = ymd(addDays(oldEnd, deltaDays));
    }
    const prev = events;
    setEvents((arr) => arr.map((x) => (x.id === id ? { ...x, start_date: newStart, end_date: newEnd } : x)));
    try {
      await api.patch(`/events/${id}/dates`, { start_date: newStart, end_date: newEnd });
      toast.success("Événement déplacé");
    } catch {
      setEvents(prev);
      toast.error("Impossible de déplacer l'événement");
    }
  };

  const selectedEvents = selectedDate ? eventsForDay(selectedDate) : [];

  // ICS export — by period (current month for month/agenda, current week for week, current day for day)
  const icsHref = useMemo(() => {
    let s, e;
    if (view === "week") {
      s = startOfWeek(cursor);
      e = addDays(s, 6);
    } else if (view === "day") {
      s = cursor; e = cursor;
    } else {
      s = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      e = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    }
    return `${API}/export/events.ics?start=${ymd(s)}&end=${ymd(e)}`;
  }, [view, cursor]);

  return (
    <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-10 fade-up">
      <div className="flex items-end justify-between flex-wrap gap-6 mb-8">
        <div>
          <div className="label-mono mb-3">Vue d'ensemble · programmation</div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95]">
            {headerTitle.main}{" "}
            <span className="text-[#FF5A00] font-mono font-medium text-4xl sm:text-5xl">{headerTitle.sub}</span>
          </h1>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center border border-zinc-800" data-testid="view-switcher">
            {[
              { id: "month", label: "Mois" },
              { id: "week", label: "Semaine" },
              { id: "day", label: "Jour" },
              { id: "agenda", label: "Agenda" },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                data-testid={`view-${v.id}`}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                  view === v.id ? "bg-[#FF5A00] text-white" : "bg-transparent text-zinc-400 hover:text-white"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2" data-testid="calendar-controls">
            <Button onClick={goToday} className="rounded-none bg-transparent border border-zinc-800 hover:bg-[#1C1C21] text-white text-xs font-bold uppercase tracking-widest" data-testid="cal-today">
              Aujourd'hui
            </Button>
            <Button onClick={() => navigate(-1)} className="rounded-none bg-transparent border border-zinc-800 hover:bg-[#1C1C21] text-white p-2" data-testid="cal-prev">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button onClick={() => navigate(1)} className="rounded-none bg-transparent border border-zinc-800 hover:bg-[#1C1C21] text-white p-2" data-testid="cal-next">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <a
            href={icsHref}
            data-testid="ics-export"
            className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-800 hover:border-[#FF5A00] hover:text-[#FF5A00] text-xs font-bold uppercase tracking-widest text-white"
          >
            <Download className="w-4 h-4" /> .ics
          </a>
          <ShareDialog />
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2" data-testid="calendar-legend">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 label-mono"><span className="w-3 h-3 bg-[#FF5A00]" /> Concert</div>
          <div className="flex items-center gap-2 label-mono"><span className="w-3 h-3 bg-[#FACC15]" /> Spectacle</div>
          <div className="flex items-center gap-2 label-mono"><span className="w-3 h-3 bg-[#38BDF8]" /> Résidence</div>
        </div>
        {view !== "agenda" && (
          <div className="flex items-center gap-2 label-mono">
            <Move className="w-3 h-3" /> Glissez un événement pour le déplacer
          </div>
        )}
      </div>

      {view === "agenda" ? (
        <AgendaView
          cursor={cursor}
          events={events}
          venueById={venueById}
          artistById={artistById}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div>
            {view === "month" && (
              <MonthView
                cursor={cursor}
                today={today}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                eventsForDay={eventsForDay}
                isSameDay={isSameDay}
                startDrag={startDrag}
              />
            )}
            {view === "week" && (
              <WeekView
                cursor={cursor}
                today={today}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                eventsForDay={eventsForDay}
                isSameDay={isSameDay}
                startDrag={startDrag}
              />
            )}
            {view === "day" && (
              <DayView
                date={cursor}
                events={eventsForDay(cursor)}
                venueById={venueById}
                artistById={artistById}
              />
            )}
          </div>

          <aside className="border border-zinc-800 bg-[#121215] p-5 h-fit lg:sticky lg:top-24" data-testid="calendar-side">
            <div className="label-mono mb-2">
              {selectedDate
                ? selectedDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                : "Sélectionnez un jour"}
            </div>
            {!selectedDate ? (
              <p className="text-sm text-zinc-500">Cliquez sur une date pour voir les événements.</p>
            ) : selectedEvents.length === 0 ? (
              <p className="text-sm text-zinc-500 border border-dashed border-zinc-800 p-6 text-center">
                Aucun événement ce jour
              </p>
            ) : (
              <ul className="space-y-3">
                {selectedEvents.map((e) => (
                  <li key={e.id} className="border border-zinc-800 p-3 bg-[#0A0A0C]" data-testid={`side-event-${e.id}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Circle className="w-2 h-2" fill={TYPE_DOT[e.type]} color={TYPE_DOT[e.type]} />
                      <span className="label-mono">{TYPE_LABEL[e.type]}</span>
                      <span className="label-mono text-zinc-500">· {STATUS_LABEL[e.status]}</span>
                    </div>
                    <div className="font-display font-bold">{e.title}</div>
                    {venueById[e.venue_id] && (
                      <div className="flex items-center gap-1 text-xs text-zinc-400 mt-1">
                        <MapPin className="w-3 h-3" />{venueById[e.venue_id].name}
                      </div>
                    )}
                    {e.artist_ids?.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-zinc-400 mt-1">
                        <Users className="w-3 h-3" />
                        {e.artist_ids.map((id) => artistById[id]?.name).filter(Boolean).join(", ")}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => openRoadmap(e.id)}
                      data-testid={`side-roadmap-${e.id}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-[#FF5A00] hover:underline"
                    >
                      <FileDown className="w-3 h-3" /> Feuille de route PDF
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function EventChip({ ev, startDrag, compact = false }) {
  return (
    <div
      onPointerDown={(e) => startDrag(e, ev.id)}
      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 truncate cursor-grab active:cursor-grabbing select-none touch-none ${TYPE_BG[ev.type]} ${compact ? "" : "mb-1"}`}
      data-testid={`chip-${ev.id}`}
      style={{ touchAction: "none" }}
    >
      {ev.title}
    </div>
  );
}

function MonthView({ cursor, today, selectedDate, setSelectedDate, eventsForDay, isSameDay, startDrag }) {
  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const firstDow = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const arr = [];
    for (let i = firstDow - 1; i >= 0; i--) arr.push({ date: new Date(year, month - 1, prevDays - i), out: true });
    for (let d = 1; d <= daysInMonth; d++) arr.push({ date: new Date(year, month, d), out: false });
    while (arr.length < 42) {
      const last = arr[arr.length - 1].date;
      const next = addDays(last, 1);
      arr.push({ date: next, out: next.getMonth() !== month });
    }
    return arr;
  }, [cursor]);

  return (
    <div className="border border-zinc-800 bg-[#121215]" data-testid="calendar-grid">
      <div className="grid grid-cols-7 border-b border-zinc-800">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="p-3 label-mono text-center border-r border-zinc-800 last:border-r-0">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map(({ date, out }, i) => {
          const evs = eventsForDay(date);
          const isToday = isSameDay(date, today);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          return (
            <div
              key={i}
              onClick={() => setSelectedDate(date)}
              data-dropdate={ymd(date)}
              data-testid={`cal-day-${ymd(date)}`}
              className={`cal-day text-left cursor-pointer ${out ? "out" : ""} ${isToday ? "today" : ""} ${isSelected ? "bg-[#17171c]" : ""}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`font-mono tabular-nums text-sm ${out ? "text-zinc-600" : isToday ? "text-[#FF5A00] font-bold" : "text-zinc-300"}`}>
                  {String(date.getDate()).padStart(2, "0")}
                </span>
                {evs.length > 0 && <span className="label-mono text-[9px]">{evs.length}</span>}
              </div>
              <div className="space-y-1">
                {evs.slice(0, 3).map((ev) => <EventChip key={ev.id} ev={ev} startDrag={startDrag} compact />)}
                {evs.length > 3 && <div className="label-mono text-[9px]">+{evs.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ cursor, today, selectedDate, setSelectedDate, eventsForDay, isSameDay, startDrag }) {
  const start = startOfWeek(cursor);
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(start, i));

  return (
    <div className="border border-zinc-800 bg-[#121215]" data-testid="week-grid">
      <div className="grid grid-cols-7 border-b border-zinc-800">
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={i} className={`p-3 border-r border-zinc-800 last:border-r-0 ${isToday ? "bg-[#1C1C21]" : ""}`}>
              <div className="label-mono">{WEEKDAYS_SHORT[i]}</div>
              <div className={`font-mono tabular-nums text-xl ${isToday ? "text-[#FF5A00] font-bold" : "text-white"}`}>
                {String(d.getDate()).padStart(2, "0")}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7 min-h-[400px]">
        {days.map((d, i) => {
          const evs = eventsForDay(d);
          const isSelected = selectedDate && isSameDay(d, selectedDate);
          return (
            <div
              key={i}
              onClick={() => setSelectedDate(d)}
              data-dropdate={ymd(d)}
              data-testid={`week-day-${ymd(d)}`}
              className={`p-3 border-r border-zinc-800 last:border-r-0 cursor-pointer min-h-[400px] ${isSelected ? "bg-[#17171c]" : "hover:bg-[#15151a]"}`}
            >
              <div className="space-y-1.5">
                {evs.length === 0 && <div className="label-mono text-[9px]">—</div>}
                {evs.map((ev) => <EventChip key={ev.id} ev={ev} startDrag={startDrag} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ date, events, venueById, artistById }) {
  const dow = (date.getDay() + 6) % 7;
  return (
    <div className="border border-zinc-800 bg-[#121215]" data-testid="day-view">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-baseline justify-between">
        <div>
          <div className="label-mono">{WEEKDAYS_LONG[dow]}</div>
          <div className="font-display text-3xl font-black tracking-tighter">
            {String(date.getDate()).padStart(2, "0")} {MONTHS[date.getMonth()]}
          </div>
        </div>
        <div className="label-mono">{events.length} événement{events.length !== 1 ? "s" : ""}</div>
      </div>

      {events.length === 0 ? (
        <div className="p-12 text-center">
          <div className="font-display text-xl font-bold">Journée libre</div>
          <div className="text-sm text-zinc-500 mt-1">Aucun événement programmé ce jour.</div>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {events.map((e) => (
            <li key={e.id} className="p-5 hover:bg-[#15151a] transition-colors" data-testid={`day-event-${e.id}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2" style={{ background: TYPE_DOT[e.type] }} />
                    <span className="label-mono">{TYPE_LABEL[e.type]}</span>
                    <span className="label-mono text-zinc-500">· {STATUS_LABEL[e.status]}</span>
                  </div>
                  <div className="font-display text-xl font-bold">{e.title}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-zinc-400">
                    {venueById[e.venue_id] && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />{venueById[e.venue_id].name}
                      </span>
                    )}
                    {e.artist_ids?.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {e.artist_ids.map((id) => artistById[id]?.name).filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>
                  {e.notes && <p className="mt-2 text-sm text-zinc-400 line-clamp-2">{e.notes}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => openRoadmap(e.id)}
                  data-testid={`day-roadmap-${e.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-800 hover:border-[#FF5A00] hover:text-[#FF5A00] text-xs font-bold uppercase tracking-widest"
                >
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

function AgendaView({ cursor, events, venueById, artistById }) {
  // Show events for the cursor's month, grouped by date
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

  // Group by day (of start_date, clamped to month)
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
    <div className="border border-zinc-800 bg-[#121215]" data-testid="agenda-view">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <div className="label-mono">Liste · {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</div>
          <div className="font-display text-2xl font-bold">{monthEvents.length} événement{monthEvents.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="label-mono">
          {ymd(monthStart)} → {ymd(monthEnd)}
        </div>
      </div>

      {monthEvents.length === 0 ? (
        <div className="p-12 text-center">
          <List className="w-10 h-10 mx-auto text-zinc-700 mb-3" />
          <div className="font-display text-xl font-bold">Aucun événement ce mois-ci</div>
        </div>
      ) : (
        <ul>
          {groups.map(([dayKey, evs]) => {
            const d = parseYMD(dayKey);
            const dow = d ? (d.getDay() + 6) % 7 : 0;
            return (
              <li key={dayKey} className="grid grid-cols-1 md:grid-cols-[180px_1fr] border-b border-zinc-800 last:border-b-0" data-testid={`agenda-day-${dayKey}`}>
                <div className="px-5 py-4 border-b md:border-b-0 md:border-r border-zinc-800 bg-[#0F0F12]">
                  <div className="label-mono">{d ? WEEKDAYS_LONG[dow] : ""}</div>
                  <div className="font-display text-2xl font-black tracking-tighter leading-none mt-1">
                    {d ? String(d.getDate()).padStart(2, "0") : dayKey}
                  </div>
                  <div className="label-mono text-zinc-500 mt-1">{d ? MONTHS[d.getMonth()] : ""}</div>
                </div>
                <ul className="divide-y divide-zinc-800">
                  {evs.map((e) => (
                    <li key={e.id} className="p-4 hover:bg-[#15151a] transition-colors" data-testid={`agenda-event-${e.id}`}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2" style={{ background: TYPE_DOT[e.type] }} />
                            <span className="label-mono">{TYPE_LABEL[e.type]}</span>
                            <span className="label-mono text-zinc-500">· {STATUS_LABEL[e.status]}</span>
                            {e.end_date && e.end_date.slice(0, 10) !== e.start_date.slice(0, 10) && (
                              <span className="label-mono text-zinc-500">
                                · {e.start_date.slice(8, 10)} → {e.end_date.slice(8, 10)}
                              </span>
                            )}
                          </div>
                          <div className="font-display text-lg font-bold">{e.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                            {venueById[e.venue_id] && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" />{venueById[e.venue_id].name}
                              </span>
                            )}
                            {e.artist_ids?.length > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {e.artist_ids.map((id) => artistById[id]?.name).filter(Boolean).join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openRoadmap(e.id)}
                          data-testid={`agenda-roadmap-${e.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[#FF5A00] hover:underline"
                        >
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


function ShareDialog() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(null);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  const loadToken = async () => {
    try {
      const r = await api.get("/public/token");
      setToken(r.data.token);
    } catch {
      toast.error("Impossible de récupérer le lien public");
    }
  };

  useEffect(() => {
    if (open && !token) loadToken();
  }, [open, token]);

  const publicUrl = token ? `${window.location.origin}/public/${token}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("Lien copié");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const rotate = async () => {
    if (!window.confirm("Générer un nouveau lien ? L'ancien cessera de fonctionner.")) return;
    setRotating(true);
    try {
      const r = await api.post("/public/token/rotate");
      setToken(r.data.token);
      toast.success("Nouveau lien généré");
    } catch {
      toast.error("Échec de la régénération");
    } finally {
      setRotating(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid="share-open"
        className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-800 hover:border-[#FF5A00] hover:text-[#FF5A00] text-xs font-bold uppercase tracking-widest text-white"
      >
        <Share2 className="w-4 h-4" /> Partager
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#121215] border border-zinc-800 rounded-none max-w-xl text-white">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold tracking-tight">
              Lien public · lecture seule
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-zinc-400">
              Partagez ce lien avec vos équipes ou artistes pour qu'ils consultent le planning sans accès à l'administration. Les documents privés (riders, contrats) restent masqués.
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={publicUrl}
                data-testid="share-url"
                className="rounded-none bg-[#1C1C21] border-zinc-800 font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <Button
                onClick={copy}
                disabled={!token}
                data-testid="share-copy"
                className="rounded-none bg-[#FF5A00] hover:bg-[#FF7A33] text-white font-bold uppercase tracking-widest text-xs whitespace-nowrap"
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copié" : "Copier"}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                data-testid="share-preview"
                className="label-mono text-[#FF5A00] hover:underline"
              >
                Prévisualiser →
              </a>
              <Button
                onClick={rotate}
                disabled={rotating}
                variant="ghost"
                data-testid="share-rotate"
                className="rounded-none text-zinc-400 hover:text-white font-bold uppercase tracking-widest text-xs"
              >
                <RotateCw className={`w-3.5 h-3.5 mr-2 ${rotating ? "animate-spin" : ""}`} />
                Régénérer
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setOpen(false)}
              variant="ghost"
              className="rounded-none text-zinc-400"
              data-testid="share-close"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
