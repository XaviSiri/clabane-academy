"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarkLessonComplete({ lessonId, alreadyComplete }: { lessonId: string; alreadyComplete: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (alreadyComplete) {
    return <span className="badge-completed">Lesson completed</span>;
  }

  async function handleClick() {
    setLoading(true);
    try {
      await fetch(`/api/employee/lessons/${lessonId}/complete`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={loading} className="btn-primary">
      {loading ? "Marking complete…" : "Mark lesson as complete"}
    </button>
  );
}
