import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch all rows from a Supabase table, handling the 1000-row default limit
 * by paginating through results automatically.
 */
export async function fetchAllRows<T = any>(
  tableName: string,
  selectColumns: string,
  filters?: (query: any) => any,
  orderBy?: { column: string; ascending?: boolean },
  pageSize = 1000
): Promise<T[]> {
  const allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(tableName as any).select(selectColumns).range(from, from + pageSize - 1);
    if (filters) query = filters(query);
    if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });

    const { data, error } = await query;
    if (error) {
      console.error(`fetchAllRows error on ${tableName}:`, error.message);
      break;
    }

    const rows = (data as T[]) || [];
    allData.push(...rows);

    if (rows.length < pageSize) {
      hasMore = false;
    } else {
      from += pageSize;
    }
  }

  return allData;
}
