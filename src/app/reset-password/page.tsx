"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";

function RequestResetForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setDevLink(data.devResetLink ?? null);
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-3 text-sm text-slate-600">
        <p>If an active account exists for that email, a reset link has been generated.</p>
        {devLink && (
          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
            Development mode — reset link:{" "}
            <a className="break-all underline" href={devLink}>
              {devLink}
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-600">Enter your email and we&apos;ll generate a reset link.</p>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          className="input-field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

function CompleteResetForm({ token }: { token: string }) {
  const router = useRouter();
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
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to reset your password.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1500);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return <p className="text-sm text-slate-600">Password updated. Redirecting you to sign in…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
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
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return (
    <AuthShell title={token ? "Set a new password" : "Reset your password"}>
      {token ? <CompleteResetForm token={token} /> : <RequestResetForm />}
    </AuthShell>
  );
}
