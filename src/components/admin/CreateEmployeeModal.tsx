"use client";

import { useState } from "react";

export function CreateEmployeeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activationLink, setActivationLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, department, jobTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to create employee.");
        return;
      }
      setActivationLink(data.activationLink);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {activationLink ? (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-slate-900">Employee created</h2>
            <p className="text-sm text-slate-600">
              Share this activation link with the employee (email delivery is not yet configured):
            </p>
            <p className="break-all rounded-md bg-slate-50 p-3 text-xs text-slate-700">{activationLink}</p>
            <button className="btn-primary w-full" onClick={onCreated}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-lg font-medium text-slate-900">Add Employee</h2>
            {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
              <input required className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input required type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
                <input className="input-field" value={department} onChange={(e) => setDepartment(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Job title</label>
                <input className="input-field" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? "Creating…" : "Create employee"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
