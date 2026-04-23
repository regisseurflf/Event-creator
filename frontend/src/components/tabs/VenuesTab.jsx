import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, MapPin, Users } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { name: "", address: "", capacity: 0, stage_type: "", notes: "" };

export default function VenuesTab({ onMutate }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/venues").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (v) => {
    setEditing(v.id);
    setForm({
      name: v.name, address: v.address || "", capacity: v.capacity || 0,
      stage_type: v.stage_type || "", notes: v.notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Nom obligatoire"); return; }
    setSaving(true);
    try {
      const payload = { ...form, capacity: Number(form.capacity) || 0 };
      if (editing) { await api.put(`/venues/${editing}`, payload); toast.success("Lieu mis à jour"); }
      else { await api.post("/venues", payload); toast.success("Lieu créé"); }
      setOpen(false);
      await load();
      onMutate?.();
    } catch { toast.error("Erreur lors de l'enregistrement"); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Supprimer ce lieu ?")) return;
    await api.delete(`/venues/${id}`);
    toast.success("Lieu supprimé");
    await load();
    onMutate?.();
  };

  return (
    <div data-testid="venues-tab">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Lieux</h2>
          <p className="label-mono mt-1">{items.length} lieux référencés</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} data-testid="new-venue-btn" className="rounded-none bg-[#FF5A00] hover:bg-[#FF7A33] text-white font-bold uppercase tracking-widest text-xs">
              <Plus className="w-4 h-4 mr-2" /> Nouveau lieu
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#121215] border border-zinc-800 rounded-none max-w-2xl text-white">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-bold tracking-tight">
                {editing ? "Modifier le lieu" : "Nouveau lieu"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <Field label="Nom *">
                <Input data-testid="venue-name" className="rounded-none bg-[#1C1C21] border-zinc-800" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Adresse">
                <Input data-testid="venue-address" className="rounded-none bg-[#1C1C21] border-zinc-800" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Capacité">
                  <Input data-testid="venue-capacity" type="number" className="rounded-none bg-[#1C1C21] border-zinc-800 font-mono" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                </Field>
                <Field label="Type de scène">
                  <Input data-testid="venue-stage" className="rounded-none bg-[#1C1C21] border-zinc-800" value={form.stage_type} onChange={(e) => setForm({ ...form, stage_type: e.target.value })} placeholder="Frontale, quadri…" />
                </Field>
              </div>
              <Field label="Notes (loges, backline…)">
                <Textarea data-testid="venue-notes" className="rounded-none bg-[#1C1C21] border-zinc-800 min-h-[100px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="ghost" className="rounded-none text-zinc-400" onClick={() => setOpen(false)} data-testid="venue-cancel">Annuler</Button>
              <Button onClick={save} disabled={saving} data-testid="venue-save" className="rounded-none bg-[#FF5A00] hover:bg-[#FF7A33] text-white font-bold uppercase tracking-widest text-xs">
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((v) => (
            <div key={v.id} className="border border-zinc-800 bg-[#121215] p-5 hover:border-[#FF5A00] transition-colors" data-testid={`venue-card-${v.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-display text-lg font-bold truncate">{v.name}</div>
                  {v.address && (
                    <div className="mt-1 flex items-center gap-1 text-sm text-zinc-400 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{v.address}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <IconBtn onClick={() => openEdit(v)} testId={`edit-venue-${v.id}`}><Pencil className="w-3.5 h-3.5" /></IconBtn>
                  <IconBtn danger onClick={() => remove(v.id)} testId={`delete-venue-${v.id}`}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs">
                {v.capacity ? (
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-[#FF5A00]" />
                    <span className="font-mono tabular-nums">{v.capacity}</span>
                    <span className="label-mono">places</span>
                  </div>
                ) : null}
                {v.stage_type && <span className="label-mono">{v.stage_type}</span>}
              </div>
              {v.notes && <p className="text-sm text-zinc-400 mt-3 line-clamp-3">{v.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
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

function IconBtn({ children, onClick, danger, testId }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className={`p-1.5 border border-zinc-800 hover:border-zinc-600 transition-colors ${danger ? "hover:text-red-500" : "hover:text-white"} text-zinc-400`}>
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-zinc-800 p-12 text-center">
      <MapPin className="w-10 h-10 mx-auto text-zinc-700 mb-3" />
      <div className="font-display text-xl font-bold">Aucun lieu</div>
      <div className="text-sm text-zinc-500 mt-1">Ajoutez vos salles et lieux partenaires.</div>
    </div>
  );
}
