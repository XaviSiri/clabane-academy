"use client";

import { useState } from "react";

interface Video {
  id: string;
  title: string;
  description: string | null;
  fileSizeBytes: string | null;
  durationSeconds: number | null;
  mimeType: string | null;
  isPublished: boolean;
  completionThresholdPercent: number;
}

function formatBytes(bytes: string | null): string {
  if (!bytes) return "—";
  const n = Number(bytes);
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "duration unknown";
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes} min ${remainder} sec` : `${minutes} min`;
}

function getVideoDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(Number.isFinite(video.duration) ? Math.round(video.duration) : undefined);
    };
    video.onerror = () => resolve(undefined);
    video.src = URL.createObjectURL(file);
  });
}

/** Uploads via XHR (not fetch) so we get real upload progress events. */
function uploadWithProgress(opts: {
  url: string;
  method: "PUT" | "POST";
  body: File | FormData;
  contentType?: string;
  onProgress: (percent: number) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method, opts.url);
    if (opts.contentType) xhr.setRequestHeader("Content-Type", opts.contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(opts.body);
  });
}

async function uploadFile(
  file: File,
  getUploadUrlEndpoint: string,
  onProgress: (percent: number) => void
): Promise<{ storageKey: string }> {
  const urlRes = await fetch(getUploadUrlEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSizeBytes: file.size }),
  });
  const urlData = await urlRes.json();
  if (!urlRes.ok) throw new Error(urlData.error || "Unable to prepare upload.");

  if (urlData.mode === "direct") {
    await uploadWithProgress({ url: urlData.uploadUrl, method: "PUT", body: file, contentType: file.type, onProgress });
  } else {
    const form = new FormData();
    form.append("file", file);
    form.append("storageKey", urlData.storageKey);
    await uploadWithProgress({ url: urlData.uploadEndpoint, method: "POST", body: form, onProgress });
  }
  return { storageKey: urlData.storageKey };
}

export function VideoManager({ lessonId, initialVideos }: { lessonId: string; initialVideos: Video[] & { id: string }[] }) {
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const duration = await getVideoDuration(file);
      const { storageKey } = await uploadFile(file, "/api/admin/videos/upload-url", setProgress);
      const res = await fetch(`/api/admin/lessons/${lessonId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          storageKey,
          fileSizeBytes: file.size,
          mimeType: file.type,
          durationSeconds: duration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to save video.");
      setVideos((prev) => [...prev, data.video]);
      setTitle("");
      setDescription("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setProgress(null);
    }
  }

  async function togglePublish(video: Video & { id: string }) {
    const res = await fetch(`/api/admin/videos/${video.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !video.isPublished }),
    });
    const data = await res.json();
    if (res.ok) setVideos((prev) => prev.map((v) => (v.id === video.id ? data.video : v)));
  }

  async function togglePreview(videoId: string) {
    if (previewingId === videoId) {
      setPreviewingId(null);
      setPreviewUrl(null);
      return;
    }
    setPreviewError(null);
    setPreviewUrl(null);
    setPreviewingId(videoId);
    try {
      const res = await fetch(`/api/employee/videos/${videoId}/stream-url`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load preview.");
      setPreviewUrl(data.url);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Unable to load preview.");
    }
  }

  async function handleDelete(videoId: string) {
    if (!confirm("Delete this video? This removes it from storage and cannot be undone.")) return;
    const res = await fetch(`/api/admin/videos/${videoId}`, { method: "DELETE" });
    if (res.ok) {
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      if (previewingId === videoId) {
        setPreviewingId(null);
        setPreviewUrl(null);
      }
    }
  }

  async function handleReplace(videoId: string, replaceFile: File) {
    setError(null);
    setProgress(0);
    try {
      const duration = await getVideoDuration(replaceFile);
      const { storageKey } = await uploadFile(replaceFile, "/api/admin/videos/upload-url", setProgress);
      const res = await fetch(`/api/admin/videos/${videoId}/replace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageKey,
          fileSizeBytes: replaceFile.size,
          mimeType: replaceFile.type,
          durationSeconds: duration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to replace video.");
      setVideos((prev) => prev.map((v) => (v.id === videoId ? data.video : v)));
      if (previewingId === videoId) {
        setPreviewingId(null);
        setPreviewUrl(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Replace failed.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-sm font-medium text-slate-700">Videos</h2>

      <ul className="divide-y divide-slate-100">
        {videos.map((video) => (
          <li key={video.id} data-video-id={video.id} className="space-y-2 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">{video.title}</p>
                <p className="text-xs text-slate-500">
                  {formatBytes(video.fileSizeBytes)} · {formatDuration(video.durationSeconds)} · completes at{" "}
                  {video.completionThresholdPercent}%
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={video.isPublished ? "badge-completed" : "badge-not-started"}>
                  {video.isPublished ? "Published" : "Draft"}
                </span>
                <button className="btn-secondary text-xs" onClick={() => togglePreview(video.id)}>
                  {previewingId === video.id ? "Hide preview" : "Preview"}
                </button>
                <button className="btn-secondary text-xs" onClick={() => togglePublish(video)}>
                  {video.isPublished ? "Unpublish" : "Publish"}
                </button>
                <button className="btn-danger text-xs" onClick={() => handleDelete(video.id)}>
                  Delete
                </button>
              </div>
            </div>
            {previewingId === video.id && (
              <div className="max-w-md">
                {previewError && <p className="text-xs text-red-600">{previewError}</p>}
                {previewUrl && (
                  <video src={previewUrl} controls className="aspect-video w-full rounded-md bg-black" />
                )}
                {!previewUrl && !previewError && <p className="text-xs text-slate-400">Loading preview…</p>}
              </div>
            )}
            <label className="block text-xs text-slate-500">
              Replace file:{" "}
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="text-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleReplace(video.id, f);
                }}
              />
            </label>
          </li>
        ))}
        {videos.length === 0 && <p className="py-2 text-sm text-slate-500">No videos uploaded yet.</p>}
      </ul>

      <form onSubmit={handleUpload} className="space-y-3 rounded-md border border-slate-200 p-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Upload New Video</h3>
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
          <input required className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <textarea className="input-field" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Video file (MP4, WebM, MOV)</label>
          <input
            required
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {progress !== null && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-[#0d1b3e] transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <button type="submit" disabled={progress !== null} className="btn-primary">
          {progress !== null ? `Uploading… ${progress}%` : "Upload video"}
        </button>
      </form>
    </div>
  );
}
