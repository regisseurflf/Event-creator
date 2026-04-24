import { useCallback, useEffect, useMemo, useState } from "react";
import { api, fileUrl, openRoadmap } from "@/lib/api";
import EventForm from "@/components/EventForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Ticket, FileText, MapPin, Search, Filter, FileDown } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL = { confirmed: "Confirmé", option: "Option", cancelled: "Annulé" };
const STATUS_CLR = {
  confirmed: "text-[#22C55E] border-[#22C55E]/40",
  option: "text-[#F59E0B] border-[#F59E0B]/40",
  cancelled: "text-[#EF4444] border-[#EF4444]/40",
};
const TYPE_LABEL = { concert: "Concert", spectacle: "Spectacle", residence: "Résidence" };
const TYPE_DOT = { concert: "bg-[#FF5A00]", spectacle: "bg-[#FACC15]", residence: "bg-[#38BDF8]" };

// Fix: parse date as local time to avoid UTC-offset day shift
const fmtDate = (d) => {
  if (!d) return "—";
  const local = new Date(d + "T00:00:00");
  return local.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

export default function EventsTab({ onMutate }) {
  const [items, setItems] = useState([]);
  const [artists, setArtists] = useState([]);
  const [venues, setVenues] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, title }

  const load = useCallback(async () => {
    try {
      const [e, a, v] = await Promise.all([
        api.get("/events"),
        api.get("/artists"),
        api.get("/venues"),
      ]);
      setItems(e.data);
      setArtists(a.data);
      setVenues(v.data);
    } catch {
      toast.error("Impossible de charger les données");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const venueById = useMemo(() => Object.fromEntries(venues.map((v) => [v.id, v])), [venues]);
  const artistById = useMemo(() => Object.fromEntries(artists.map((a) => [a.id, a])), [artists]);

  const filtered = items.filter((e) => {
    if (filterType !== "all" && e.type !== filterType) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.title.toLowerCase().includes(s) ||
      (venueById[e.venue_id]?.name || "").toLowerCase().includes(s) ||
      e.artist_ids.some((id) => (artistById[id]?.name || "").toLowerCase().includes(s))
    );
  });

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (ev) => { setEditing(ev); setOpen(true); };

  const confirmDelete = (ev) => setDeleteTarget({ id: ev.id, title: ev.title });

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/events/${deleteTarget.id}`);
      toast.success("Événement supprimé");
      await load();
      onMutate?.();
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div data-testid="events-tab">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Événements</h2>
          <p className="label-mono mt-1">{filtered.length} / {items.length} · concerts · spectacles · résidences</p>
        </div>
        <Button onClick={openNew} data-testid="new-event-btn" className="rounded-none bg-[#FF5A00] hover:bg-[#FF7A33] text-white font-bold uppercase tracking-widest text-xs">
          <Plus className="w-4 h-4 mr-2" /> Nouvel événement
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            data-testid="events-search"
            className="rounded-none bg-[#1C1C21] border-zinc-800"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-zinc-500 mr-2" />
          {["all", "concert", "spectacle", "residence"].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              data-testid={`filter-${t}`}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border transition-colors ${
                filterType === t
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-zinc-400 border-zinc-800 hover:border-zinc-600"
              }`}
            >
              {t === "all" ? "Tous" : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-zinc-800 p-12 text-center">
          <Ticket className="w-10 h-10 mx-auto text-zinc-700 mb-3" />
          <div className="font-display text-xl font-bold">Aucun événement</div>
          <div className="text-sm text-zinc-500 mt-1">Programmez votre premier concert ou spectacle.</div>
        </div>
      ) : (
        <div className="border border-zinc-800 bg-[#121215] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <Th>Type</Th>
                <Th>Titre</Th>
                <Th>Date</Th>
                <Th>Lieu</Th>
                <Th>Artistes</Th>
                <Th>Statut</Th>
                <Th>Docs</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-zinc-800/60 hover:bg-[#17171c] transition-colors" data-testid={`event-row-${e.id}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 ${TYPE_DOT[e.type]}`} />
                      <span className="label-mono">{TYPE_LABEL[e.type]}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {e.poster_file_id && (
                        <img src={fileUrl(e.poster_file_id)} alt="" className="w-8 h-8 object-cover border border-zinc-800" />
                      )}
                      <span className="font-medium">{e.title}</span>
                    </div>
                  </td>
                  <td className="p-3 font-mono tabular-nums whitespace-nowrap">{fmtDate(e.start_date)}</td>
                  <td className="p-3">
                    {venueById[e.venue_id] ? (
                      <span className="inline-flex items-center gap-1 text-zinc-300">
                        <MapPin className="w-3 h-3 text-zinc-500" />
                        {venueById[e.venue_id].name}
                      </span>
                    ) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="p-3 text-zinc-300">
                    {e.artist_ids.length === 0 ? (
                      <span className="text-zinc-600">—</span>
                    ) : (
                      e.artist_ids.map((id) => artistById[id]?.name).filter(Boolean).join(", ")
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border ${STATUS_CLR[e.status]}`}>
                      {STATUS_LABEL[e.status]}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openRoadmap(e.id)}
                        title="Feuille de route PDF"
                        data-testid={`roadmap-event-${e.id}`}
                        className="text-zinc-400 hover:text-[#FF5A00]"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      {e.tech_rider_file_id && <a href={fileUrl(e.tech_rider_file_id)} target="_blank" rel="noreferrer" title="Fiche technique" className="text-zinc-400 hover:text-[#FF5A00]"><FileText className="w-4 h-4" /></a>}
                      {e.contract_file_id && <a href={fileUrl(e.contract_file_id)} target="_blank" rel="noreferrer" title="Contrat" className="text-zinc-400 hover:text-[#FF5A00]"><FileText className="w-4 h-4" /></a>}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1 justify-end">
                      <IconBtn onClick={() => openEdit(e)} testId={`edit-event-${e.id}`}><Pencil className="w-3.5 h-3.5" /></IconBtn>
                      <IconBtn danger onClick={() => confirmDelete(e)} testId={`delete-event-${e.id}`}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EventForm
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        initialType="concert"
        artists={artists}
        venues={venues}
        onSaved={() => { load(); onMutate?.(); }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-[#121215] border border-zinc-800 rounded-none text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-bold">Supprimer l'événement ?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              « {deleteTarget?.title} » sera définitivement supprimé. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none bg-transparent border border-zinc-800 text-zinc-400 hover:text-white">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="rounded-none bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest text-xs"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`p-3 label-mono font-normal ${className}`}>{children}</th>;
}

function IconBtn({ children, onClick, danger, testId }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className={`p-1.5 border border-zinc-800 hover:border-zinc-600 transition-colors ${danger ? "hover:text-red-500" : "hover:text-white"} text-zinc-400`}>
      {children}
    </button>
  );
}
