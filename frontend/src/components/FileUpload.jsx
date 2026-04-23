import { useRef, useState, useEffect } from "react";
import { Upload, FileText, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { api, fileUrl } from "@/lib/api";
import { toast } from "sonner";

/**
 * Reusable file uploader. Handles images (preview) and PDFs (name + link).
 * value = fileId string or null
 */
export default function FileUpload({
  label,
  value,
  onChange,
  accept = "image/*,application/pdf",
  kind = "any", // "image" | "pdf" | "any"
  testId = "file-upload",
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (value) {
      api
        .get(`/files/${value}/info`)
        .then((r) => !cancelled && setInfo(r.data))
        .catch(() => !cancelled && setInfo(null));
    } else {
      setInfo(null);
    }
    return () => {
      cancelled = true;
    };
  }, [value]);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(res.data.id);
      toast.success("Fichier envoyé");
    } catch (err) {
      toast.error("Échec de l'envoi");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clear = () => {
    onChange(null);
    setInfo(null);
  };

  const isImage = info?.content_type?.startsWith("image/");
  const isPdf = info?.content_type === "application/pdf";

  return (
    <div className="space-y-2" data-testid={testId}>
      {label && <div className="label-mono">{label}</div>}
      {!info ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          data-testid={`${testId}-pick`}
          className="w-full border border-dashed border-zinc-700 hover:border-[#FF5A00] bg-[#121215] px-4 py-6 flex flex-col items-center justify-center gap-2 text-zinc-400 hover:text-white transition-colors"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : kind === "pdf" ? (
            <FileText className="w-5 h-5" />
          ) : kind === "image" ? (
            <ImageIcon className="w-5 h-5" />
          ) : (
            <Upload className="w-5 h-5" />
          )}
          <span className="text-xs uppercase tracking-widest font-semibold">
            {uploading ? "Envoi…" : "Cliquer pour importer"}
          </span>
          <span className="label-mono text-[10px] normal-case tracking-wider">
            {kind === "pdf" ? "PDF uniquement · max 25 Mo" : kind === "image" ? "JPG / PNG · max 25 Mo" : "Image ou PDF · max 25 Mo"}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-[#121215] border border-zinc-800">
          {isImage ? (
            <img
              src={fileUrl(info.id)}
              alt={info.original_filename}
              className="w-14 h-14 object-cover border border-zinc-800"
            />
          ) : (
            <div className="w-14 h-14 flex items-center justify-center bg-[#1C1C21] border border-zinc-800">
              {isPdf ? <FileText className="w-5 h-5 text-[#FF5A00]" /> : <Upload className="w-5 h-5" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">{info.original_filename}</div>
            <div className="label-mono text-[10px] normal-case tracking-wider">
              {(info.size / 1024).toFixed(1)} Ko
            </div>
          </div>
          <a
            href={fileUrl(info.id)}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white"
            data-testid={`${testId}-view`}
          >
            Voir
          </a>
          <button
            type="button"
            onClick={clear}
            className="text-zinc-400 hover:text-red-500"
            data-testid={`${testId}-remove`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onPick}
        className="hidden"
        data-testid={`${testId}-input`}
      />
    </div>
  );
}
