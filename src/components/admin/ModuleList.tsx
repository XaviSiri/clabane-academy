"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ModuleRow {
  id: string;
  title: string;
  slug: string;
  order: number;
  isPublished: boolean;
  isRequired: boolean;
  lessons: { id: string }[];
  assessment: { id: string } | null;
}

export function ModuleList() {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/modules");
    const data = await res.json();
    setModules(data.modules ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/modules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug, order: modules.length }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Unable to create module.");
      return;
    }
    setTitle("");
    setSlug("");
    setShowCreate(false);
    load();
  }

  async function togglePublish(mod: ModuleRow) {
    await fetch(`/api/admin/modules/${mod.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !mod.isPublished }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <button className="btn-primary" onClick={() => setShowCreate((v) => !v)}>
        {showCreate ? "Cancel" : "+ New Module"}
      </button>

      {showCreate && (
        <form onSubmit={handleCreate} className="card space-y-3">
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input required className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Slug (lowercase, hyphens)</label>
            <input
              required
              className="input-field"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="who-we-are"
            />
          </div>
          <button type="submit" className="btn-primary">
            Create module
          </button>
        </form>
      )}

      <div className="grid gap-3">
        {modules.map((mod) => (
          <div key={mod.id} className="card flex items-center justify-between">
            <div>
              <Link href={`/admin/content/${mod.id}`} className="font-medium text-[var(--clabane-accent)] hover:underline">
                {mod.title}
              </Link>
              <p className="text-xs text-slate-500">
                {mod.lessons.length} lessons · {mod.assessment ? "Assessment configured" : "No assessment yet"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={mod.isPublished ? "badge-completed" : "badge-not-started"}>
                {mod.isPublished ? "Published" : "Draft"}
              </span>
              <button className="btn-secondary text-xs" onClick={() => togglePublish(mod)}>
                {mod.isPublished ? "Unpublish" : "Publish"}
              </button>
            </div>
          </div>
        ))}
        {!loading && modules.length === 0 && <p className="text-sm text-slate-500">No modules yet.</p>}
      </div>
    </div>
  );
}
