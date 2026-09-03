"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Option {
  id: string;
  text: string;
}
interface Question {
  id: string;
  text: string;
  marks: number;
  options: Option[];
}
interface Attempt {
  id: string;
  attemptNumber: number;
}
interface Assessment {
  id: string;
  title: string;
  passMarkPercent: number;
  moduleId: string;
  questions: Question[];
}
interface SubmitResult {
  scorePercent: number;
  passed: boolean;
  passMark: number;
  attemptNumber: number;
}

export function AssessmentRunner({ assessmentId }: { assessmentId: string }) {
  const [state, setState] = useState<"loading" | "in-progress" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/employee/assessments/${assessmentId}/start`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to start this assessment.");
        setAssessment(data.assessment);
        setAttempt(data.attempt);
        setState("in-progress");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to start this assessment.");
        setState("error");
      }
    })();
  }, [assessmentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!attempt || !assessment) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        answers: assessment.questions.map((q) => ({
          questionId: q.id,
          selectedOptionId: answers[q.id] ?? "",
        })),
      };
      const res = await fetch(`/api/employee/assessments/attempts/${attempt.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to submit your answers.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit your answers.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "loading") {
    return <p className="text-sm text-slate-500">Loading assessment…</p>;
  }

  if (state === "error") {
    return (
      <div className="card">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="card space-y-4 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Assessment Result</h1>
        <p className="text-4xl font-bold text-slate-900">{result.scorePercent}%</p>
        {result.passed ? (
          <p className="badge-completed inline-block">Passed</p>
        ) : (
          <div className="space-y-3">
            <p className="badge-failed inline-block">
              Assessment not passed. A minimum score of {result.passMark}% is required.
            </p>
          </div>
        )}
        <p className="text-xs text-slate-500">Attempt {result.attemptNumber}</p>
        <div className="flex justify-center gap-3 pt-2">
          {!result.passed && (
            <button onClick={() => window.location.reload()} className="btn-primary">
              Retake assessment
            </button>
          )}
          <Link href={`/modules/${assessment?.moduleId}`} className="btn-secondary">
            Back to module
          </Link>
        </div>
      </div>
    );
  }

  if (!assessment) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card">
        <h1 className="text-xl font-semibold text-slate-900">{assessment.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pass mark: {assessment.passMarkPercent}%. Answer every question, then submit.
        </p>
      </div>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {assessment.questions.map((q, idx) => (
        <div key={q.id} className="card">
          <p className="mb-3 text-sm font-medium text-slate-900">
            {idx + 1}. {q.text}
          </p>
          <div className="space-y-2">
            {q.options.map((opt) => (
              <label key={opt.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  required
                  name={`question-${q.id}`}
                  value={opt.id}
                  checked={answers[q.id] === opt.id}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                />
                {opt.text}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? "Submitting…" : "Submit assessment"}
      </button>
    </form>
  );
}
