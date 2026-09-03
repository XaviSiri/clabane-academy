"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CreateEmployeeModal } from "./CreateEmployeeModal";

interface Employee {
  id: string;
  email: string;
  status: string;
  fullName?: string;
  department?: string;
  jobTitle?: string;
  startDate?: string;
  lastLoginAt?: string;
  completedModules: number;
  hasCertificate: boolean;
}

export function EmployeeTable() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    const res = await fetch(`/api/admin/employees?${params.toString()}`);
    const data = await res.json();
    setEmployees(data.employees ?? []);
    setLoading(false);
  }, [q, status]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <input
            placeholder="Search name, email, department…"
            className="input-field w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="input-field w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="PENDING_ACTIVATION">Pending Activation</option>
            <option value="ACTIVE">Active</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + Add Employee
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Modules</th>
              <th className="px-4 py-3">Certificate</th>
              <th className="px-4 py-3">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/employees/${e.id}`} className="font-medium text-[#0d1b3e] hover:underline">
                    {e.fullName || "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{e.email}</td>
                <td className="px-4 py-3 text-slate-600">{e.department || "—"}</td>
                <td className="px-4 py-3">
                  <StatusPill status={e.status} />
                </td>
                <td className="px-4 py-3 text-slate-600">{e.completedModules}</td>
                <td className="px-4 py-3 text-slate-600">{e.hasCertificate ? "Issued" : "—"}</td>
                <td className="px-4 py-3 text-slate-500">
                  {e.lastLoginAt ? new Date(e.lastLoginAt).toLocaleDateString("en-GB") : "Never"}
                </td>
              </tr>
            ))}
            {!loading && employees.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateEmployeeModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const classes: Record<string, string> = {
    ACTIVE: "badge-completed",
    PENDING_ACTIVATION: "badge-in-progress",
    DEACTIVATED: "badge-failed",
  };
  const labels: Record<string, string> = {
    ACTIVE: "Active",
    PENDING_ACTIVATION: "Pending Activation",
    DEACTIVATED: "Deactivated",
  };
  return <span className={classes[status] ?? "badge-not-started"}>{labels[status] ?? status}</span>;
}
