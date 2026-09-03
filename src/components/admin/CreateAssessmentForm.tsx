"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateAssessmentForm({ moduleId }: { moduleId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("Module Assessment");
  const [passMark, setPassMark] = useState(80);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}/assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, passMarkPercent: passMark }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to create assessment.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Assessment title</label>
        <input required className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Pass mark (%)</label>
        <input
          type="number"
          min={1}
          max={100}
          required
          className="input-field w-32"
          value={passMark}
          onChange={(e) => setPassMark(Number(e.target.value))}
        />
      </div>
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Creating…" : "Create assessment"}
      </button>
    </form>
  );
}
