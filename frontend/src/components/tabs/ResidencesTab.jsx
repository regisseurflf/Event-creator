import { useEffect, useMemo, useState } from "react";
import { api, fileUrl } from "@/lib/api";
import EventForm from "@/components/EventForm";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Palette, MapPin, CalendarRange, FileText } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL = { confirmed: "Confirmé", option: "Option", cancelled: "Annulé" };
const STATUS_CLR = {
  confirmed: "text-[#22C55E] border-[#22C55E]/40",
  option: "text-[#F59E0B] border-[#F59E0B]/40",
  cancelled: "text-[#EF4444] border-[#EF4444]/40",
};

export default function ResidencesTab({ onMutate }) {
  const [items, setItems] = useState([]);
  const [artists, setArtists] = useState([]);
  const [venues, setVenues] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const [e, a, v] = await Promise.all([
      api.get("/events", { params: { type: "residence" } }),
      api.get("/artists"),
      api.get("/venues"),
    ]);
    setItems(e.data);
    setArtists(a.data);
    setVenues(v.data);
  };

  useEffect(() => { load(); }, []);

  const venueById = useMemo(() => Object.fromEntries(venues.map((v) => [v.id, v])), [venues]);
  const artistById = useMemo(() => Object.fromEntries(artists.map((a) => [a.id, a])), [artists]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (ev) => { setEditing(ev); setOpen(true); };

  const remove = async (id) => {
    if (!window.confirm("Supprimer cette résidence ?")) return;
    await api.delete(`/events/${id}`);
    toast.success("Résidence supprimée");
    await load();
    onMutate?.();
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const daysBetween = (a, b) => {
    if (!a || !b) return null;
    const d = Math.round((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24)) + 1;
    return d > 0 ? d : null;
  };

  return (
    <div data-testid="residences-tab">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Résidences d'artistes</h2>
          <p className="label-mono mt-1">{items.length} résidences · périodes multi-jours</p>
        </div>
        <Button onClick={openNew} data-testid="new-residence-btn" className="rounded-none bg-[#FF5A00] hover:bg-[#FF7A33] text-white font-bold uppercase tracking-widest text-xs">
          <Plus className="w-4 h-4 mr-2" /> Nouvelle résidence
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="border border-dashed border-zinc-800 p-12 text-center">
          <Palette className="w-10 h-10 mx-auto text-zinc-700 mb-3" />
          <div className="font-display text-xl font-bold">Aucune résidence</div>
          <div className="text-sm text-zinc-500 mt-1">Planifiez une résidence artistique sur plusieurs jours.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((r) => {
            const days = daysBetween(r.start_date, r.end_date);
            return (
              <div key={r.id} className="border border-zinc-800 bg-[#121215] hover:border-[#38BDF8] transition-colors" data-testid={`residence-card-${r.id}`}>
                <div className="flex">
                  {r.poster_file_id ? (
                    <div className="w-32 shrink-0 bg-[#1C1C21]">
                      <img src={fileUrl(r.poster_file_id)} alt="" className="w-full h-full object-cover aspect-[3/4]" />
                    </div>
                  ) : (
                    <div className="w-32 shrink-0 bg-[#1C1C21] aspect-[3/4] flex items-center justify-center border-r border-zinc-800">
                      <Palette className="w-10 h-10 text-zinc-700" />
                    </div>
                  )}
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 bg-[#38BDF8]" />
                          <span className="label-mono">Résidence</span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border ${STATUS_CLR[r.status]}`}>
                            {STATUS_LABEL[r.status]}
                          </span>
                        </div>
                        <div className="font-display text-xl font-bold truncate">{r.title}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <IconBtn onClick={() => openEdit(r)} testId={`edit-residence-${r.id}`}><Pencil className="w-3.5 h-3.5" /></IconBtn>
                        <IconBtn danger onClick={() => remove(r.id)} testId={`delete-residence-${r.id}`}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-sm">
                      <div className="flex items-center gap-2 text-zinc-300">
                        <CalendarRange className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span className="font-mono tabular-nums">
                          {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                        </span>
                        {days && <span className="label-mono">· {days}j</span>}
                      </div>
                      {venueById[r.venue_id] && (
                        <div className="flex items-center gap-2 text-zinc-400">
                          <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                          {venueById[r.venue_id].name}
                        </div>
                      )}
                      {r.artist_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {r.artist_ids.map((id) => (
                            <span key={id} className="label-mono border border-zinc-800 px-2 py-0.5 bg-[#1C1C21]">
                              {artistById[id]?.name || "?"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {r.notes && <p className="text-sm text-zinc-400 mt-3 line-clamp-2">{r.notes}</p>}

                    <div className="flex items-center gap-3 mt-3">
                      {r.tech_rider_file_id && (
                        <a href={fileUrl(r.tech_rider_file_id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#FF5A00] hover:underline">
                          <FileText className="w-3 h-3" /> Fiche technique
                        </a>
                      )}
                      {r.contract_file_id && (
                        <a href={fileUrl(r.contract_file_id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#FF5A00] hover:underline">
                          <FileText className="w-3 h-3" /> Contrat
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EventForm
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        initialType="residence"
        lockType={!editing}
        onSaved={() => { load(); onMutate?.(); }}
      />
    </div>
  );
}

function IconBtn({ children, onClick, danger, testId }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className={`p-1.5 border border-zinc-800 hover:border-zinc-600 transition-colors ${danger ? "hover:text-red-500" : "hover:text-white"} text-zinc-400`}>
      {children}
    </button>
  );
}
