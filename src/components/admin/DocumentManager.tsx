"use client";

import { useState } from "react";

interface DocumentRow {
  id: string;
  title: string;
  fileSizeBytes: string | null;
  mimeType: string | null;
  isPublished: boolean;
}

function formatBytes(bytes: string | null): string {
  if (!bytes) return "—";
  const n = Number(bytes);
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentManager({ lessonId, initialDocuments }: { lessonId: string; initialDocuments: DocumentRow[] }) {
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocuments);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const urlRes = await fetch("/api/admin/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSizeBytes: file.size }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error || "Unable to prepare upload.");

      if (urlData.mode === "direct") {
        const putRes = await fetch(urlData.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!putRes.ok) throw new Error("Upload to storage failed.");
      } else {
        const form = new FormData();
        form.append("file", file);
        form.append("storageKey", urlData.storageKey);
        const postRes = await fetch(urlData.uploadEndpoint, { method: "POST", body: form });
        if (!postRes.ok) throw new Error("Upload failed.");
      }

      const res = await fetch(`/api/admin/lessons/${lessonId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, storageKey: urlData.storageKey, fileSizeBytes: file.size, mimeType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to save document.");
      setDocuments((prev) => [...prev, data.document]);
      setTitle("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function togglePublish(doc: DocumentRow) {
    const res = await fetch(`/api/admin/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !doc.isPublished }),
    });
    const data = await res.json();
    if (res.ok) setDocuments((prev) => prev.map((d) => (d.id === doc.id ? data.document : d)));
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/documents/${id}`, { method: "DELETE" });
    if (res.ok) setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-sm font-medium text-slate-700">Supporting Documents</h2>

      <ul className="divide-y divide-slate-100">
        {documents.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-900">{doc.title}</p>
              <p className="text-xs text-slate-500">
                {doc.mimeType} · {formatBytes(doc.fileSizeBytes)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={doc.isPublished ? "badge-completed" : "badge-not-started"}>
                {doc.isPublished ? "Published" : "Draft"}
              </span>
              <button className="btn-secondary text-xs" onClick={() => togglePublish(doc)}>
                {doc.isPublished ? "Unpublish" : "Publish"}
              </button>
              <button className="btn-danger text-xs" onClick={() => handleDelete(doc.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
        {documents.length === 0 && <p className="py-2 text-sm text-slate-500">No documents uploaded yet.</p>}
      </ul>

      <form onSubmit={handleUpload} className="space-y-3 rounded-md border border-slate-200 p-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Upload New Document</h3>
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
          <input required className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">File (PDF, DOCX, PPTX)</label>
          <input
            required
            type="file"
            accept=".pdf,.docx,.pptx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <button type="submit" disabled={uploading} className="btn-primary">
          {uploading ? "Uploading…" : "Upload document"}
        </button>
      </form>
    </div>
  );
}
