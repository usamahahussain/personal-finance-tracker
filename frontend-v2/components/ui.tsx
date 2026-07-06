import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export function StatusMessage({
  error,
  notice
}: {
  error?: string | null;
  notice?: string | null;
}) {
  if (!error && !notice) {
    return null;
  }

  return (
    <div className={error ? "statusLine error" : "statusLine success"} role="status">
      {error ? <AlertCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
      <span>{error || notice}</span>
    </div>
  );
}

export function MetricTile({
  label,
  value,
  detail,
  tone = "neutral",
  icon
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
  icon: ReactNode;
}) {
  return (
    <section className={`metricTile ${tone}`}>
      <span className="metricIcon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {detail && <span>{detail}</span>}
      </div>
    </section>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="emptyBlock">
      <Loader2 className="spin" aria-hidden="true" />
      <strong>{label}</strong>
    </div>
  );
}

export function EmptyBlock({
  title,
  detail,
  icon
}: {
  title: string;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="emptyBlock">
      {icon}
      <div>
        <strong>{title}</strong>
        {detail && <span>{detail}</span>}
      </div>
    </div>
  );
}
