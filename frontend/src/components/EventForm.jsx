import { useEffect, useState } from "react";
import { api, fileUrl } from "@/lib/api";
import FileUpload from "@/components/FileUpload";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const EMPTY = (type = "concert") => ({
  title: "",
  type,
  artist_ids: [],
  venue_id: "",
  start_date: "",
  end_date: "",
  fee: 0,
  currency: "EUR",
  status: "option",
  poster_file_id: null,
  tech_rider_file_id: null,
  contract_file_id: null,
  notes: "",
});

export default function EventForm({ open, onOpenChange, onSaved, editing, initialType = "concert", lockType = false }) {
  const [form, setForm] = useState(EMPTY(initialType));
  const [artists, setArtists] = useState([]);
  const [venues, setVenues] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      api.get("/artists").then((r) => setArtists(r.data));
      api.get("/venues").then((r) => setVenues(r.data));
      if (editing) {
        setForm({
          title: editing.title,
          type: editing.type,
          artist_ids: editing.artist_ids || [],
          venue_id: editing.venue_id || "",
          start_date: editing.start_date?.slice(0, 10) || "",
          end_date: editing.end_date?.slice(0, 10) || "",
          fee: editing.fee || 0,
          currency: editing.currency || "EUR",
          status: editing.status || "option",
          poster_file_id: editing.poster_file_id || null,
          tech_rider_file_id: editing.tech_rider_file_id || null,
          contract_file_id: editing.contract_file_id || null,
          notes: editing.notes || "",
        });
      } else {
        setForm(EMPTY(initialType));
      }
    }
  }, [open, editing, initialType]);

  const toggleArtist = (id) => {
    setForm((f) => ({
      ...f,
      artist_ids: f.artist_ids.includes(id)
        ? f.artist_ids.filter((x) => x !== id)
        : [...f.artist_ids, id],
    }));
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Titre obligatoire"); return; }
    if (!form.start_date) { toast.error("Date de début obligatoire"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        venue_id: form.venue_id || null,
        end_date: form.end_date || null,
        fee: Number(form.fee) || 0,
      };
      if (editing) {
        await api.put(`/events/${editing.id}`, payload);
        toast.success("Événement mis à jour");
      } else {
        await api.post("/events", payload);
        toast.success("Événement créé");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#121215] border border-zinc-800 rounded-none max-w-3xl text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold tracking-tight">
            {editing ? "Modifier l'événement" : (form.type === "residence" ? "Nouvelle résidence" : "Nouvel événement")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label="Titre *">
            <Input data-testid="event-title" className="rounded-none bg-[#1C1C21] border-zinc-800" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex : Festival d'automne" />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Type">
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })} disabled={lockType}>
                <SelectTrigger data-testid="event-type" className="rounded-none bg-[#1C1C21] border-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1C1C21] border-zinc-800 text-white rounded-none">
                  <SelectItem value="concert">Concert</SelectItem>
                  <SelectItem value="spectacle">Spectacle</SelectItem>
                  <SelectItem value="residence">Résidence</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Statut">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="event-status" className="rounded-none bg-[#1C1C21] border-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1C1C21] border-zinc-800 text-white rounded-none">
                  <SelectItem value="option">Option</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Lieu">
              <Select value={form.venue_id || "none"} onValueChange={(v) => setForm({ ...form, venue_id: v === "none" ? "" : v })}>
                <SelectTrigger data-testid="event-venue" className="rounded-none bg-[#1C1C21] border-zinc-800">
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent className="bg-[#1C1C21] border-zinc-800 text-white rounded-none">
                  <SelectItem value="none">— Aucun —</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Date de début *">
              <Input data-testid="event-start" type="date" className="rounded-none bg-[#1C1C21] border-zinc-800 font-mono" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </Field>
            <Field label={form.type === "residence" ? "Date de fin *" : "Date de fin"}>
              <Input data-testid="event-end" type="date" className="rounded-none bg-[#1C1C21] border-zinc-800 font-mono" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Field label="Cachet">
                <Input data-testid="event-fee" type="number" step="0.01" className="rounded-none bg-[#1C1C21] border-zinc-800 font-mono" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
              </Field>
            </div>
            <Field label="Devise">
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger data-testid="event-currency" className="rounded-none bg-[#1C1C21] border-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1C1C21] border-zinc-800 text-white rounded-none">
                  <SelectItem value="EUR">EUR €</SelectItem>
                  <SelectItem value="USD">USD $</SelectItem>
                  <SelectItem value="GBP">GBP £</SelectItem>
                  <SelectItem value="CHF">CHF</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div>
            <Label className="label-mono">Artistes</Label>
            {artists.length === 0 ? (
              <div className="mt-2 text-sm text-zinc-500 border border-dashed border-zinc-800 p-3">Aucun artiste disponible. Créez-en un d'abord.</div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2" data-testid="artists-picker">
                {artists.map((a) => {
                  const active = form.artist_ids.includes(a.id);
                  return (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => toggleArtist(a.id)}
                      data-testid={`artist-pick-${a.id}`}
                      className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border transition-colors ${
                        active
                          ? "bg-[#FF5A00] text-white border-[#FF5A00]"
                          : "bg-[#1C1C21] text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white"
                      }`}
                    >
                      {a.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FileUpload
              label="Affiche"
              value={form.poster_file_id}
              onChange={(id) => setForm({ ...form, poster_file_id: id })}
              kind="image"
              accept="image/*"
              testId="event-poster"
            />
            <FileUpload
              label="Fiche technique (PDF)"
              value={form.tech_rider_file_id}
              onChange={(id) => setForm({ ...form, tech_rider_file_id: id })}
              kind="pdf"
              accept="application/pdf"
              testId="event-rider"
            />
            <FileUpload
              label="Contrat (PDF)"
              value={form.contract_file_id}
              onChange={(id) => setForm({ ...form, contract_file_id: id })}
              kind="pdf"
              accept="application/pdf"
              testId="event-contract"
            />
          </div>

          <Field label="Notes">
            <Textarea data-testid="event-notes" className="rounded-none bg-[#1C1C21] border-zinc-800 min-h-[80px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="rounded-none text-zinc-400" onClick={() => onOpenChange(false)} data-testid="event-cancel">Annuler</Button>
          <Button onClick={save} disabled={saving} data-testid="event-save" className="rounded-none bg-[#FF5A00] hover:bg-[#FF7A33] text-white font-bold uppercase tracking-widest text-xs">
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return (
    <div className="grid gap-1.5">
      <Label className="label-mono">{label}</Label>
      {children}
    </div>
  );
}
