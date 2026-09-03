"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";

export default function ActivatePage() {
  return (
    <Suspense fallback={null}>
      <ActivateForm />
    </Suspense>
  );
}

function ActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to activate your account.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title="Activate your account">
        <p className="text-sm text-slate-600">
          This activation link is missing a token. Please use the link from your account activation
          email, or contact your administrator.
        </p>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell title="Account activated">
        <p className="text-sm text-slate-600">
          Your account is now active. Redirecting you to sign in…
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Activate your account" subtitle="Welcome to Clabane Academy">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
        <p className="text-sm text-slate-600">Set a password to activate your account and sign in.</p>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={10}
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            At least 10 characters, including upper case, lower case, and a number.
          </p>
        </div>
        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-slate-700">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            minLength={10}
            className="input-field"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Activating…" : "Activate account"}
        </button>
      </form>
    </AuthShell>
  );
}
