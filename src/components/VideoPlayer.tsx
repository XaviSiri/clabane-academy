"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fetches a short-lived signed URL for the video (never a permanent storage
 * URL) and streams directly from object storage — the <video> element's
 * `src` points at the object storage host, so playback and range requests
 * never pass through the app server. Progress is reported periodically so
 * "resume where you left off" and completion tracking both work.
 */
export function VideoPlayer({ videoId, onCompleted }: { videoId: string; onCompleted?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(90);
  const [resumeAt, setResumeAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const completedRef = useRef(false);
  const lastReportRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [urlRes, progressRes] = await Promise.all([
          fetch(`/api/employee/videos/${videoId}/stream-url`),
          fetch(`/api/employee/videos/${videoId}/progress`),
        ]);
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlData.error || "Unable to load this video.");
        const progressData = await progressRes.json();
        if (cancelled) return;
        setSrc(urlData.url);
        setThreshold(urlData.completionThresholdPercent ?? 90);
        if (progressData.progress) {
          completedRef.current = progressData.progress.isCompleted;
          setResumeAt(progressData.progress.lastPositionSeconds ?? 0);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load this video.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  async function reportProgress(positionSeconds: number, watchedPercent: number) {
    try {
      const res = await fetch(`/api/employee/videos/${videoId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionSeconds, watchedPercent }),
      });
      const data = await res.json();
      if (data.progress?.isCompleted && !completedRef.current) {
        completedRef.current = true;
        onCompleted?.();
      }
    } catch {
      // Best-effort; the next timeupdate tick will retry.
    }
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const now = Date.now();
    if (now - lastReportRef.current < 4000) return; // throttle to ~every 4s
    lastReportRef.current = now;
    const percent = (video.currentTime / video.duration) * 100;
    reportProgress(Math.round(video.currentTime), percent);
  }

  function handleEnded() {
    const video = videoRef.current;
    if (!video) return;
    reportProgress(Math.round(video.duration), 100);
  }

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (video && resumeAt > 0 && resumeAt < video.duration - 5) {
      video.currentTime = resumeAt;
    }
  }

  if (error) {
    return <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  if (!src) {
    return <div className="flex aspect-video items-center justify-center rounded-md bg-slate-100 text-sm text-slate-400">Loading video…</div>;
  }

  return (
    <div className="space-y-1">
      <video
        ref={videoRef}
        src={src}
        controls
        className="aspect-video w-full rounded-md bg-black"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
        onPause={handleTimeUpdate}
      >
        Your browser does not support video playback.
      </video>
      <p className="text-xs text-slate-400">This video is marked complete once you&apos;ve watched {threshold}%.</p>
    </div>
  );
}
