"use client";

import { useState } from "react";

export function DocumentLink({ documentId, title }: { documentId: string; title: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/employee/documents/${documentId}/download-url`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to access this document.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to access this document.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading} className="text-sm font-medium text-[var(--clabane-accent)] underline hover:no-underline">
        {loading ? "Preparing…" : `📄 ${title}`}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
