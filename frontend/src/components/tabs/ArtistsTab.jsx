import { useCallback, useEffect, useState } from "react";
import { api, fileUrl } from "@/lib/api";
import FileUpload from "@/components/FileUpload";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, ExternalLink, Music } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { name: "", bio: "", genre: "", website: "", social_links: "", photo_file_id: null };

export default function ArtistsTab({ onMutate }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, name }

  const load = useCallback(async () => {
    try {
      const r = await api.get("/artists");
      setItems(r.data);
    } catch {
      toast.error("Impossible de charger les artistes");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (a) => {
    setEditing(a.id);
    setForm({
      name: a.name, bio: a.bio || "", genre: a.genre || "",
      website: a.website || "", social_links: a.social_links || "",
      photo_file_id: a.photo_file_id || null,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Nom obligatoire"); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/artists/${editing}`, form);
        toast.success("Artiste mis à jour");
      } else {
        await api.post("/artists", form);
        toast.success("Artiste créé");
      }
      setOpen(false);
      await load();
      onMutate?.();
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false); }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/artists/${deleteTarget.id}`);
      toast.success("Artiste supprimé");
      await load();
      onMutate?.();
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div data-testid="artists-tab">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Artistes</h2>
          <p className="label-mono mt-1">{items.length} fiches</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} data-testid="new-artist-btn"
              className="rounded-none bg-[#FF5A00] hover:bg-[#FF7A33] text-white font-bold uppercase tracking-widest text-xs">
              <Plus className="w-4 h-4 mr-2" /> Nouvel artiste
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#121215] border border-zinc-800 rounded-none max-w-2xl text-white">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-bold tracking-tight">
                {editing ? "Modifier l'artiste" : "Nouvel artiste"}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 text-sm">
                {editing ? "Modifiez la fiche de cet artiste." : "Créez une nouvelle fiche artiste."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <Field label="Nom *">
                <Input data-testid="artist-name" className="rounded-none bg-[#1C1C21] border-zinc-800" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Genre">
                  <Input data-testid="artist-genre" className="rounded-none bg-[#1C1C21] border-zinc-800" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="Post-rock, jazz…" />
                </Field>
                <Field label="Site web">
                  <Input data-testid="artist-website" className="rounded-none bg-[#1C1C21] border-zinc-800" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" />
                </Field>
              </div>
              <Field label="Biographie">
                <Textarea data-testid="artist-bio" className="rounded-none bg-[#1C1C21] border-zinc-800 min-h-[100px]" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </Field>
              <Field label="Réseaux sociaux">
                <Input data-testid="artist-social" className="rounded-none bg-[#1C1C21] border-zinc-800" value={form.social_links} onChange={(e) => setForm({ ...form, social_links: e.target.value })} placeholder="Instagram, Bandcamp…" />
              </Field>
              <FileUpload label="Photo de l'artiste" value={form.photo_file_id}
                onChange={(id) => setForm({ ...form, photo_file_id: id })}
                kind="image" accept="image/*" testId="artist-photo" />
            </div>
            <DialogFooter>
              <Button variant="ghost" className="rounded-none text-zinc-400" onClick={() => setOpen(false)} data-testid="artist-cancel">Annuler</Button>
              <Button onClick={save} disabled={saving} data-testid="artist-save"
                className="rounded-none bg-[#FF5A00] hover:bg-[#FF7A33] text-white font-bold uppercase tracking-widest text-xs">
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Music} label="Aucun artiste" hint="Créez votre premier artiste pour commencer." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((a) => (
            <div key={a.id} className="border border-zinc-800 bg-[#121215] p-0 hover:border-[#FF5A00] transition-colors" data-testid={`artist-card-${a.id}`}>
              <div className="aspect-[4/3] bg-[#1C1C21] overflow-hidden border-b border-zinc-800">
                {a.photo_file_id ? (
                  <img src={fileUrl(a.photo_file_id)} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-10 h-10 text-zinc-700" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-lg font-bold truncate">{a.name}</div>
                    {a.genre && <div className="label-mono mt-1">{a.genre}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconBtn title="Modifier" onClick={() => openEdit(a)} testId={`edit-artist-${a.id}`}><Pencil className="w-3.5 h-3.5" /></IconBtn>
                    <IconBtn title="Supprimer" onClick={() => setDeleteTarget({ id: a.id, name: a.name })} danger testId={`delete-artist-${a.id}`}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                  </div>
                </div>
                {a.bio && <p className="text-sm text-zinc-400 mt-2 line-clamp-2">{a.bio}</p>}
                {(a.website || a.social_links) && (
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    {a.website && (
                      <a href={a.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#FF5A00] hover:underline">
                        <ExternalLink className="w-3 h-3" /> Site
                      </a>
                    )}
                    {a.social_links && <span className="label-mono truncate">{a.social_links}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-[#121215] border border-zinc-800 rounded-none text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-bold">Supprimer l'artiste ?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              « {deleteTarget?.name} » sera définitivement supprimé et retiré de tous les événements associés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none bg-transparent border border-zinc-800 text-zinc-400 hover:text-white">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="rounded-none bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest text-xs">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function IconBtn({ children, onClick, title, danger, testId }) {
  return (
    <button type="button" title={title} onClick={onClick} data-testid={testId}
      className={`p-1.5 border border-zinc-800 hover:border-zinc-600 transition-colors ${danger ? "hover:text-red-500" : "hover:text-white"} text-zinc-400`}>
      {children}
    </button>
  );
}

function EmptyState({ icon: Icon, label, hint }) {
  return (
    <div className="border border-dashed border-zinc-800 p-12 text-center">
      <Icon className="w-10 h-10 mx-auto text-zinc-700 mb-3" />
      <div className="font-display text-xl font-bold">{label}</div>
      <div className="text-sm text-zinc-500 mt-1">{hint}</div>
    </div>
  );
}
