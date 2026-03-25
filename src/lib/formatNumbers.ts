/**
 * Format large numbers for display:
 * - Streams: International format (K, M, B)
 * - Revenue (INR): Indian format (T=Thousand, L=Lakh, Cr=Crore)
 */

export function formatStreams(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

export function formatRevenue(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10_000_000) return sign + '₹' + (abs / 10_000_000).toFixed(2).replace(/\.00$/, '') + ' Cr';
  if (abs >= 100_000) return sign + '₹' + (abs / 100_000).toFixed(2).replace(/\.00$/, '') + ' L';
  if (abs >= 1_000) return sign + '₹' + (abs / 1_000).toFixed(1).replace(/\.0$/, '') + ' T';
  return sign + '₹' + abs.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
