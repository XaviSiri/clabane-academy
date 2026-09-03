"use client";

import { useState } from "react";

export function CertificateDownloadButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/employee/certificate/download-url");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to download your certificate.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download your certificate.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading} className="btn-primary">
        {loading ? "Preparing…" : "Download certificate"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
