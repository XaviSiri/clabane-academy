"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function EmployeeStatusToggle({ employeeId, status }: { employeeId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setStatus(newStatus: "ACTIVE" | "DEACTIVATED") {
    setLoading(true);
    try {
      await fetch(`/api/admin/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (status === "PENDING_ACTIVATION") {
    return <span className="badge-in-progress">Awaiting activation</span>;
  }

  return status === "ACTIVE" ? (
    <button disabled={loading} className="btn-danger" onClick={() => setStatus("DEACTIVATED")}>
      Deactivate
    </button>
  ) : (
    <button disabled={loading} className="btn-primary" onClick={() => setStatus("ACTIVE")}>
      Activate
    </button>
  );
}
