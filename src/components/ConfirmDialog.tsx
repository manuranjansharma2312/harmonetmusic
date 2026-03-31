export function ConfirmDialog({
  title, message, onConfirm, onCancel, confirmLabel = 'Delete',
}: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void; confirmLabel?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="glass-strong rounded-2xl p-4 sm:p-6 max-w-sm w-full relative animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground text-sm mb-6 break-words">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg border border-border text-foreground font-medium hover:bg-muted/50 transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-medium hover:opacity-90 transition-all">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
