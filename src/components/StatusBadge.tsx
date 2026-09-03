const LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

const CLASS_NAMES: Record<string, string> = {
  NOT_STARTED: "badge-not-started",
  IN_PROGRESS: "badge-in-progress",
  COMPLETED: "badge-completed",
  FAILED: "badge-failed",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={CLASS_NAMES[status] ?? "badge-not-started"}>{LABELS[status] ?? status}</span>;
}
