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
  return normalizePercent(isSubLabel ? subLabelCut : hiddenCut);
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