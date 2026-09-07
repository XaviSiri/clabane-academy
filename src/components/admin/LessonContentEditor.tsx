"use client";

import { useState } from "react";

export function LessonContentEditor({ lessonId, initialContent }: { lessonId: string; initialContent: string }) {
  const [content, setContent] = useState(initialContent);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/admin/lessons/${lessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card space-y-3">
      <h2 className="text-sm font-medium text-slate-700">Lesson Content</h2>
      <p className="text-xs text-slate-500">
        Supports simple formatting: <code># Heading</code>, <code>## Subheading</code>, <code>- bullet</code>,{" "}
        <code>&gt; callout / key takeaway</code>, and <code>**bold**</code>. Blank lines start a new paragraph.
      </p>
      <textarea
        className="input-field min-h-[200px] font-mono text-xs"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="[INSERT LESSON CONTENT — key learning points, text, etc.]"
      />
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save content"}
        </button>
        {saved && <span className="text-xs text-emerald-600">Saved.</span>}
      </div>
    </div>
  );
}
