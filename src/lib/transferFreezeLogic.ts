import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseFetchAll';

/**
 * Calculate net payable for a report entry using its snapshot cut.
 * If no snapshot, fall back to the provided default cut.
 */
function entryNetPayable(entry: { net_generated_revenue: number; cut_percent_snapshot?: number | null }, fallbackCut: number): number {
  const rev = Number(entry.net_generated_revenue) || 0;
  const cut = entry.cut_percent_snapshot != null ? Number(entry.cut_percent_snapshot) : fallbackCut;
  return rev * (1 - Math.min(Math.max(cut, 0), 100) / 100);
}

interface ReportEntry {
  id: string;
  net_generated_revenue: number;
  cut_percent_snapshot?: number | null;
  reporting_month: string;
  table: string;
}

/**
 * For Release transfers: Determine which transferred report entries to freeze.
 * 
 * Logic:
 * - If old owner was paid for an entry's revenue (via withdrawals), freeze it
 * - If not yet paid, leave it active for the new owner
 * 
 * Uses FIFO: oldest entries are considered "paid first"
 */
export async function computeReleaseFreezeIds(
  oldUserId: string,
  isrcs: string[],
  fallbackCut: number,
): Promise<{ freezeIds: { table: string; ids: string[] }[]; unfreezeIds: { table: string; ids: string[] }[] }> {
  if (isrcs.length === 0) return { freezeIds: [], unfreezeIds: [] };

  // 1. Fetch transferred entries from all 3 report tables
  const [ottEntries, ytEntries, vevoEntries] = await Promise.all([
    fetchAllRows('report_entries', 'id, net_generated_revenue, cut_percent_snapshot, reporting_month', 
      (q) => q.eq('user_id', oldUserId).eq('revenue_frozen', false).in('isrc', isrcs),
      { column: 'reporting_month', ascending: true }),
    fetchAllRows('youtube_report_entries', 'id, net_generated_revenue, cut_percent_snapshot, reporting_month',
      (q) => q.eq('user_id', oldUserId).eq('revenue_frozen', false).in('isrc', isrcs),
      { column: 'reporting_month', ascending: true }),
    fetchAllRows('vevo_report_entries', 'id, net_generated_revenue, cut_percent_snapshot, reporting_month',
      (q) => q.eq('user_id', oldUserId).eq('revenue_frozen', false).in('isrc', isrcs),
      { column: 'reporting_month', ascending: true }),
  ]);

  const allTransferred: ReportEntry[] = [
    ...(ottEntries as any[]).map(e => ({ ...e, table: 'report_entries' })),
    ...(ytEntries as any[]).map(e => ({ ...e, table: 'youtube_report_entries' })),
    ...(vevoEntries as any[]).map(e => ({ ...e, table: 'vevo_report_entries' })),
  ];

  if (allTransferred.length === 0) return { freezeIds: [], unfreezeIds: [] };

  const transferredNetTotal = allTransferred.reduce((s, e) => s + entryNetPayable(e, fallbackCut), 0);

  // 2. Get old owner's TOTAL net revenue across ALL report entries (not just transferred)
  const [allOtt, allYt, allVevo] = await Promise.all([
    fetchAllRows('report_entries', 'net_generated_revenue, cut_percent_snapshot',
      (q) => q.eq('user_id', oldUserId).eq('revenue_frozen', false)),
    fetchAllRows('youtube_report_entries', 'net_generated_revenue, cut_percent_snapshot',
      (q) => q.eq('user_id', oldUserId).eq('revenue_frozen', false)),
    fetchAllRows('vevo_report_entries', 'net_generated_revenue, cut_percent_snapshot',
      (q) => q.eq('user_id', oldUserId).eq('revenue_frozen', false)),
  ]);

  const totalNetRevenue = [...(allOtt as any[]), ...(allYt as any[]), ...(allVevo as any[])]
    .reduce((s, e) => s + entryNetPayable(e, fallbackCut), 0);

  // 3. Get old owner's paid + pending withdrawals
  const withdrawals = await fetchAllRows('withdrawal_requests', 'amount, status',
    (q) => q.eq('user_id', oldUserId).in('status', ['paid', 'pending']));
  
  const paidPending = (withdrawals as any[]).reduce((s, w) => s + (Number(w.amount) || 0), 0);

  // 4. Calculate how much of the transferred entries' revenue was effectively paid
  // remaining = revenue from entries NOT being transferred
  const remainingRevenue = totalNetRevenue - transferredNetTotal;
  // If paid+pending > remaining, the excess was paid from the transferred entries
  const effectivelyPaid = Math.max(0, paidPending - Math.max(0, remainingRevenue));
  const amountToFreeze = Math.min(effectivelyPaid, transferredNetTotal);

  // 5. FIFO: sort by month ASC, freeze oldest entries first until we reach amountToFreeze
  allTransferred.sort((a, b) => a.reporting_month.localeCompare(b.reporting_month));

  const freezeMap: Record<string, string[]> = {};
  const unfreezeMap: Record<string, string[]> = {};
  let cumulative = 0;

  for (const entry of allTransferred) {
    const net = entryNetPayable(entry, fallbackCut);
    if (cumulative < amountToFreeze) {
      cumulative += net;
      (freezeMap[entry.table] ??= []).push(entry.id);
    } else {
      (unfreezeMap[entry.table] ??= []).push(entry.id);
    }
  }

  const freezeIds = Object.entries(freezeMap).map(([table, ids]) => ({ table, ids }));
  const unfreezeIds = Object.entries(unfreezeMap).map(([table, ids]) => ({ table, ids }));

  return { freezeIds, unfreezeIds };
}

/**
 * For CMS transfers: Determine which CMS report entries to freeze.
 * 
 * CMS entries don't have user_id or cut_percent_snapshot — they use channel_name 
 * matching and the cut_percent from youtube_cms_links.
 */
export async function computeCmsFreezeIds(
  oldUserId: string,
  channelName: string,
  channelCutPercent: number,
): Promise<{ freezeIds: string[]; unfreezeIds: string[] }> {
  // 1. Fetch all entries for the channel being transferred (not already frozen)
  const channelEntries = await fetchAllRows('cms_report_entries', 'id, net_generated_revenue, reporting_month',
    (q) => q.eq('channel_name', channelName).eq('revenue_frozen', false),
    { column: 'reporting_month', ascending: true });

  if ((channelEntries as any[]).length === 0) return { freezeIds: [], unfreezeIds: [] };

  const cmsEntryNet = (e: any) => {
    const rev = Number(e.net_generated_revenue) || 0;
    return rev - (rev * channelCutPercent / 100);
  };

  const transferredNetTotal = (channelEntries as any[]).reduce((s, e) => s + cmsEntryNet(e), 0);

  // 2. Get old owner's ALL CMS channels and their entries
  const { data: allLinks } = await supabase
    .from('youtube_cms_links' as any)
    .select('channel_name, cut_percent')
    .eq('user_id', oldUserId)
    .eq('status', 'linked');

  const otherChannels = ((allLinks as any[]) || []).filter(l => l.channel_name !== channelName);
  
  let otherChannelsNet = 0;
  for (const link of otherChannels) {
    const entries = await fetchAllRows('cms_report_entries', 'net_generated_revenue',
      (q) => q.eq('channel_name', link.channel_name).eq('revenue_frozen', false));
    const cut = Number(link.cut_percent) || 0;
    otherChannelsNet += (entries as any[]).reduce((s, e) => {
      const rev = Number(e.net_generated_revenue) || 0;
      return s + rev - (rev * cut / 100);
    }, 0);
  }

  const totalCmsNet = otherChannelsNet + transferredNetTotal;

  // 3. Get old owner's CMS paid + pending withdrawals
  const withdrawals = await fetchAllRows('cms_withdrawal_requests', 'amount, status',
    (q) => q.eq('user_id', oldUserId).in('status', ['paid', 'pending']));
  
  const paidPending = (withdrawals as any[]).reduce((s, w) => s + (Number(w.amount) || 0), 0);

  // 4. Calculate effectively paid from this channel
  const remainingRevenue = totalCmsNet - transferredNetTotal;
  const effectivelyPaid = Math.max(0, paidPending - Math.max(0, remainingRevenue));
  const amountToFreeze = Math.min(effectivelyPaid, transferredNetTotal);

  // 5. FIFO freeze
  const sorted = (channelEntries as any[]).sort((a, b) => a.reporting_month.localeCompare(b.reporting_month));
  
  const freezeIds: string[] = [];
  const unfreezeIds: string[] = [];
  let cumulative = 0;

  for (const entry of sorted) {
    if (cumulative < amountToFreeze) {
      cumulative += cmsEntryNet(entry);
      freezeIds.push(entry.id);
    } else {
      unfreezeIds.push(entry.id);
    }
  }

  return { freezeIds, unfreezeIds };
}
