type AppRole = 'user' | 'admin' | null;

function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}

export function getEffectiveRevenueCutPercent({
  hiddenCut,
  subLabelCut,
  isSubLabel,
}: {
  hiddenCut: number;
  subLabelCut: number;
  isSubLabel: boolean;
}): number {
  if (!isSubLabel) return normalizePercent(hiddenCut);
  // Stacked: Admin cut first, then Main Label cut on the remainder
  // combined = 1 - (1 - adminCut/100) * (1 - parentCut/100)
  const a = normalizePercent(hiddenCut) / 100;
  const b = normalizePercent(subLabelCut) / 100;
  const combined = (1 - (1 - a) * (1 - b)) * 100;
  return normalizePercent(combined);
}

export function shouldApplyRevenueCut({
  role,
  currentUserId,
  activeUserId,
}: {
  role: AppRole;
  currentUserId?: string | null;
  activeUserId?: string | null;
}): boolean {
  return role !== 'admin' || Boolean(activeUserId && activeUserId !== currentUserId);
}

export function applyRevenueCutToAmount(amount: number, cutPercent: number, applyCut: boolean): number {
  const safeAmount = Number(amount) || 0;
  if (!applyCut) return safeAmount;

  const multiplier = 1 - normalizePercent(cutPercent) / 100;
  return Number((safeAmount * multiplier).toFixed(4));
}

export function calculateAvailableBalance(netRevenue: number, paidWithdrawals: number, pendingWithdrawals: number): number {
  return Number(((Number(netRevenue) || 0) - (Number(paidWithdrawals) || 0) - (Number(pendingWithdrawals) || 0)).toFixed(4));
}

export function summarizeWithdrawals<T extends { amount: number | string; status: string }>(withdrawals: T[]) {
  return withdrawals.reduce(
    (totals, withdrawal) => {
      const amount = Number(withdrawal.amount) || 0;

      if (withdrawal.status === 'pending') totals.pending += amount;
      if (withdrawal.status === 'paid') totals.paid += amount;

      return totals;
    },
    { pending: 0, paid: 0 }
  );
}

/**
 * Apply per-row snapshot cut to a report entry's revenue.
 * If the entry has a `cut_percent_snapshot` value (i.e. it was imported after the
 * snapshot feature was added), use that frozen value. Otherwise fall back to the
 * global effective cut.
 */
export function applySnapshotCut(
  grossRevenue: number,
  snapshotCut: number | null | undefined,
  fallbackCut: number,
  applyCut: boolean,
): number {
  if (!applyCut) return Number(grossRevenue) || 0;
  const cut = snapshotCut != null ? normalizePercent(snapshotCut) : normalizePercent(fallbackCut);
  const multiplier = 1 - cut / 100;
  return Number(((Number(grossRevenue) || 0) * multiplier).toFixed(4));
}