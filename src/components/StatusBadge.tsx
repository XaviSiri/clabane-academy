// Covers both ProgressStatus (NOT_STARTED/IN_PROGRESS/COMPLETED/FAILED) and
// AttemptStatus (IN_PROGRESS/PASSED/FAILED) — PASSED reuses the "completed"
// (green) styling since it means the same thing to the viewer.
const LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  PASSED: "Passed",
  FAILED: "Failed",
};

const CLASS_NAMES: Record<string, string> = {
  NOT_STARTED: "badge-not-started",
  IN_PROGRESS: "badge-in-progress",
  COMPLETED: "badge-completed",
  PASSED: "badge-completed",
  FAILED: "badge-failed",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={CLASS_NAMES[status] ?? "badge-not-started"}>{LABELS[status] ?? status}</span>;
}
