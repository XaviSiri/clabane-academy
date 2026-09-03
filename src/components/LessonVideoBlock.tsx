"use client";

import { useRouter } from "next/navigation";
import { VideoPlayer } from "./VideoPlayer";

export function LessonVideoBlock({ videoId, title }: { videoId: string; title: string }) {
  const router = useRouter();
  return (
    <div className="space-y-2" data-video-id={videoId}>
      <h3 className="text-sm font-medium text-slate-700">{title}</h3>
      <VideoPlayer videoId={videoId} onCompleted={() => router.refresh()} />
    </div>
  );
}
