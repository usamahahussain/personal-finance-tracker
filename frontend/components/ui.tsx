import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

type PageHeaderProps = {
  kicker: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({
  kicker,
  title,
  description,
  actions
}: PageHeaderProps) {
  return (
    <div className="pageHeader">
      <div>
        <p>{kicker}</p>
        <h1>{title}</h1>
        {description && <span>{description}</span>}
      </div>
      {actions && <div className="pageActions">{actions}</div>}
    </div>
  );
}

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
    <div className={error ? "message error" : "message success"} role="status">
      {error ? (
        <AlertCircle aria-hidden="true" />
      ) : (
        <CheckCircle2 aria-hidden="true" />
      )}
      <span>{error || notice}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  detail
}: {
  icon: ReactNode;
  title: string;
  detail?: string;
}) {
  return (
    <div className="emptyState">
      <span className="emptyIcon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <strong>{title}</strong>
        {detail && <span>{detail}</span>}
      </div>
    </div>
  );
}

export function LoadingState({ title }: { title: string }) {
  return (
    <div className="emptyState">
      <span className="emptyIcon loadingIcon" aria-hidden="true">
        <Loader2 />
      </span>
      <strong>{title}</strong>
    </div>
  );
}

export function Stat({
  label,
  value,
  icon
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="statItem">
      <span className="statIcon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

export function DirectionBadge({ direction }: { direction: string }) {
  const normalized = direction.toUpperCase();

  return (
    <span
      className={`directionBadge ${
        normalized === "OUTBOUND" ? "outbound" : "inbound"
      }`}
    >
      {normalized}
    </span>
  );
}
