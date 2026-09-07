"use client";

import { useState } from "react";
import Link from "next/link";

interface Lesson {
  id: string;
  title: string;
  slug: string;
  order: number;
  isPublished: boolean;
}

export function LessonManager({ moduleId, initialLessons }: { moduleId: string; initialLessons: Lesson[] }) {
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/admin/modules/${moduleId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug, order: lessons.length }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Unable to create lesson.");
      return;
    }
    setLessons((prev) => [...prev, data.lesson]);
    setTitle("");
    setSlug("");
    setShowCreate(false);
  }

  async function togglePublish(lesson: Lesson) {
    const res = await fetch(`/api/admin/lessons/${lesson.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !lesson.isPublished }),
    });
    const data = await res.json();
    if (res.ok) {
      setLessons((prev) => prev.map((l) => (l.id === lesson.id ? data.lesson : l)));
    }
  }

  function startEditing(lesson: Lesson) {
    setEditingId(lesson.id);
    setEditTitle(lesson.title);
  }

  async function saveEdit(lessonId: string) {
    const res = await fetch(`/api/admin/lessons/${lessonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle }),
    });
    const data = await res.json();
    if (res.ok) {
      setLessons((prev) => prev.map((l) => (l.id === lessonId ? data.lesson : l)));
      setEditingId(null);
    }
  }

  async function handleDelete(lesson: Lesson) {
    if (
      !confirm(`Delete "${lesson.title}"? This removes its videos and documents from storage and cannot be undone.`)
    ) {
      return;
    }
    const res = await fetch(`/api/admin/lessons/${lesson.id}`, { method: "DELETE" });
    if (res.ok) setLessons((prev) => prev.filter((l) => l.id !== lesson.id));
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">Lessons</h2>
        <button className="btn-secondary text-xs" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Cancel" : "+ Add Lesson"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-md border border-slate-200 p-3">
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input required className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Slug</label>
            <input required className="input-field" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          </div>
          <button type="submit" className="btn-primary">
            Create lesson
          </button>
        </form>
      )}

      <ul className="divide-y divide-slate-100">
        {lessons.map((lesson, idx) => (
          <li key={lesson.id} className="flex items-center justify-between gap-3 py-2">
            {editingId === lesson.id ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  className="input-field flex-1"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  autoFocus
                />
                <button className="btn-primary text-xs" onClick={() => saveEdit(lesson.id)}>
                  Save
                </button>
                <button className="btn-secondary text-xs" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <Link
                href={`/admin/content/${moduleId}/lessons/${lesson.id}`}
                className="flex-1 text-sm font-medium text-[var(--clabane-accent)] hover:underline"
              >
                {idx + 1}. {lesson.title}
              </Link>
            )}
            {editingId !== lesson.id && (
              <div className="flex items-center gap-2">
                <span className={lesson.isPublished ? "badge-completed" : "badge-not-started"}>
                  {lesson.isPublished ? "Published" : "Draft"}
                </span>
                <button className="btn-secondary text-xs" onClick={() => togglePublish(lesson)}>
                  {lesson.isPublished ? "Unpublish" : "Publish"}
                </button>
                <button className="btn-secondary text-xs" onClick={() => startEditing(lesson)}>
                  Rename
                </button>
                <button className="btn-danger text-xs" onClick={() => handleDelete(lesson)}>
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
        {lessons.length === 0 && <p className="py-2 text-sm text-slate-500">No lessons yet.</p>}
      </ul>
    </div>
  );
}
