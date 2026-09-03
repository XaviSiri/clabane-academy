"use client";

import { useState } from "react";

interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}
interface Question {
  id: string;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  text: string;
  marks: number;
  isActive: boolean;
  options: Option[];
}
interface Assessment {
  id: string;
  title: string;
  passMarkPercent: number;
  isPublished: boolean;
  allowAnswerReview: boolean;
  questions: Question[];
}

export function AssessmentBuilder({ assessment }: { assessment: Assessment }) {
  const [data, setData] = useState(assessment);
  const [error, setError] = useState<string | null>(null);

  const [qType, setQType] = useState<"MULTIPLE_CHOICE" | "TRUE_FALSE">("MULTIPLE_CHOICE");
  const [qText, setQText] = useState("");
  const [qMarks, setQMarks] = useState(1);
  const [options, setOptions] = useState<{ text: string; isCorrect: boolean }[]>([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ]);

  async function togglePublish() {
    const res = await fetch(`/api/admin/assessments/${data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !data.isPublished }),
    });
    const json = await res.json();
    if (res.ok) setData((prev) => ({ ...prev, isPublished: json.assessment.isPublished }));
  }

  async function updatePassMark(passMarkPercent: number) {
    const res = await fetch(`/api/admin/assessments/${data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passMarkPercent }),
    });
    const json = await res.json();
    if (res.ok) setData((prev) => ({ ...prev, passMarkPercent: json.assessment.passMarkPercent }));
  }

  function optionsForType() {
    if (qType === "TRUE_FALSE") {
      return [
        { text: "True", isCorrect: options[0]?.isCorrect ?? true },
        { text: "False", isCorrect: !(options[0]?.isCorrect ?? true) },
      ];
    }
    return options;
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      type: qType,
      text: qText,
      marks: qMarks,
      options: optionsForType().filter((o) => o.text.trim().length > 0 || qType === "TRUE_FALSE"),
    };
    const res = await fetch(`/api/admin/assessments/${data.id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Unable to add question.");
      return;
    }
    setData((prev) => ({ ...prev, questions: [...prev.questions, json.question] }));
    setQText("");
    setOptions([
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
    ]);
  }

  async function handleDeleteQuestion(id: string) {
    const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
    if (res.ok) setData((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.id !== id) }));
  }

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <label className="text-sm text-slate-700">
            Pass mark:{" "}
            <input
              type="number"
              min={1}
              max={100}
              className="input-field ml-1 inline-block w-20"
              defaultValue={data.passMarkPercent}
              onBlur={(e) => updatePassMark(Number(e.target.value))}
            />
            %
          </label>
          <span className="text-sm text-slate-500">{data.questions.length} question(s)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={data.isPublished ? "badge-completed" : "badge-not-started"}>
            {data.isPublished ? "Published" : "Draft"}
          </span>
          <button className="btn-secondary text-xs" onClick={togglePublish}>
            {data.isPublished ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-medium text-slate-700">Questions</h2>
        {data.questions.map((q, idx) => (
          <div key={q.id} className="rounded-md border border-slate-200 p-3">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-900">
                {idx + 1}. {q.text} <span className="text-xs text-slate-400">({q.marks} mark(s))</span>
              </p>
              <button className="btn-danger text-xs" onClick={() => handleDeleteQuestion(q.id)}>
                Delete
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {q.options.map((o) => (
                <li key={o.id} className={o.isCorrect ? "font-medium text-emerald-700" : ""}>
                  {o.isCorrect ? "✓ " : "— "}
                  {o.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {data.questions.length === 0 && <p className="text-sm text-slate-500">No questions yet.</p>}
      </div>

      <form onSubmit={handleAddQuestion} className="card space-y-3">
        <h2 className="text-sm font-medium text-slate-700">Add Question</h2>
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="flex gap-3">
          <select className="input-field w-48" value={qType} onChange={(e) => setQType(e.target.value as never)}>
            <option value="MULTIPLE_CHOICE">Multiple Choice</option>
            <option value="TRUE_FALSE">True / False</option>
          </select>
          <input
            type="number"
            min={1}
            max={100}
            className="input-field w-24"
            value={qMarks}
            onChange={(e) => setQMarks(Number(e.target.value))}
            title="Marks"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Question text</label>
          <textarea required className="input-field" value={qText} onChange={(e) => setQText(e.target.value)} />
        </div>

        {qType === "MULTIPLE_CHOICE" ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Answer options</label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct-option"
                  checked={opt.isCorrect}
                  onChange={() =>
                    setOptions((prev) => prev.map((o, i) => ({ ...o, isCorrect: i === idx })))
                  }
                />
                <input
                  className="input-field flex-1"
                  placeholder={`Option ${idx + 1}`}
                  value={opt.text}
                  onChange={(e) =>
                    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, text: e.target.value } : o)))
                  }
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    className="text-xs text-red-600"
                    onClick={() => setOptions((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <button
                type="button"
                className="text-xs text-slate-500 underline"
                onClick={() => setOptions((prev) => [...prev, { text: "", isCorrect: false }])}
              >
                + Add option
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Correct answer</label>
            <label className="mr-4 text-sm">
              <input
                type="radio"
                checked={options[0]?.isCorrect ?? true}
                onChange={() => setOptions([{ text: "True", isCorrect: true }])}
              />{" "}
              True
            </label>
            <label className="text-sm">
              <input
                type="radio"
                checked={!(options[0]?.isCorrect ?? true)}
                onChange={() => setOptions([{ text: "True", isCorrect: false }])}
              />{" "}
              False
            </label>
          </div>
        )}

        <button type="submit" className="btn-primary">
          Add question
        </button>
      </form>
    </div>
  );
}
