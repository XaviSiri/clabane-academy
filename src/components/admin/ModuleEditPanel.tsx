"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ModuleData {
  id: string;
  title: string;
  description: string | null;
  isRequired: boolean;
}

export function ModuleEditPanel({ module: mod }: { module: ModuleData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(mod.title);
  const [description, setDescription] = useState(mod.description ?? "");
  const [isRequired, setIsRequired] = useState(mod.isRequired);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/modules/${mod.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, isRequired }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to save changes.");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Delete "${mod.title}"? This permanently removes its lessons, videos, documents, and assessment — including uploaded files in storage. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/modules/${mod.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/admin/content");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Unable to delete this module.");
        setDeleting(false);
      }
    } catch {
      setError("Unable to delete this module.");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="card space-y-3">
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
          <input required className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <textarea className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
          Required for onboarding completion
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{mod.title}</h1>
        <p className="text-sm text-slate-500">{mod.description || "[INSERT MODULE DESCRIPTION]"}</p>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <button className="btn-secondary text-xs" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button className="btn-danger text-xs" onClick={handleDelete} disabled={deleting}>
          {deleting ? "Deleting…" : "Delete module"}
        </button>
      </div>
    </div>
  );
}
