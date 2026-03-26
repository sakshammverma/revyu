import type { ReactNode } from "react";
import { Button } from "./Button";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`ui-skeleton ${className}`} />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="p-6 sm:p-10 text-center bg-paper-subtle/50 rounded-xl border border-dashed border-line-strong">
      {icon && (
        <div aria-hidden className="text-3xl mb-2">
          {icon}
        </div>
      )}
      <p className="font-semibold text-ink">{title}</p>
      {body && <p className="text-sm text-text-2 mt-1 max-w-sm mx-auto">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="p-6 text-center bg-alert-50 rounded-xl border border-alert/20">
      <p className="text-alert font-semibold">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-3">
          Try again
        </Button>
      )}
    </div>
  );
}
