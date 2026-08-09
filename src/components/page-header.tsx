export function PageHeader({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-4 h-14 px-6 border-b border-border bg-surface/50 backdrop-blur">
      <div className="min-w-0">
        <h1 className="text-sm font-semibold tracking-tight truncate">{title}</h1>
        {description ? (
          <p className="text-xs text-muted truncate">{description}</p>
        ) : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </header>
  );
}
