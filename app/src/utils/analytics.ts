export interface LeadAnalyticsItem {
  id: string;
  lead_code: string;
  module: 'web' | 'maps';
  source: string;
  found_at: string;
  status: 'new' | 'acceptable' | 'rejected' | 'contacted' | 'replied' | 'won' | 'lost';
  scored: boolean;
  score?: number | null;
  country?: string | null;
  niche?: string | null;
  reject_reason?: string | null;
  deleted_at?: string | null;
  archived_at?: string | null;
}

export interface DealAnalyticsItem {
  id: string;
  lead_code: string;
  value: number;
  currency: string;
  payment_status: 'unpaid' | 'partial' | 'paid';
  completed: boolean;
  completed_at?: string | null;
  created_at: string;
}

export interface AnalyticsKpis {
  totalLeads: number;
  scoredLeads: number;
  usefulLeadRate: number; // percentage (acceptable + contacted + replied + won) / total
  replyRate: number;      // percentage (replied + won) / max(contacted + replied + won, 1)
  winRate: number;        // percentage won / max(won + lost, 1)
  totalPipeline: number;  // sum of deal values
  totalRevenue: number;   // sum of deal values where payment_status === 'paid'
  wonDealsCount: number;
}

export interface FunnelBreakdown {
  newCount: number;
  acceptableCount: number;
  contactedCount: number;
  repliedCount: number;
  wonCount: number;
}

export interface DayBucketItem {
  date: string;
  count: number;
  webCount: number;
  mapsCount: number;
}

export interface CategoryCountItem {
  label: string;
  count: number;
  percentage: number;
}

export interface ScoreDistribution {
  low: number;      // 0-49
  medium: number;   // 50-74
  high: number;     // 75-100
  unscored: number;
}

export interface DealRevenueBucket {
  date: string;
  revenue: number;
  cumulativeRevenue: number;
  dealsCount: number;
}

export function toKolkataDateStr(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function filterLeadsByModule<T extends { module: 'web' | 'maps' }>(
  items: T[],
  module: 'all' | 'web' | 'maps'
): T[] {
  if (module === 'all') return items;
  return items.filter((item) => item.module === module);
}

export function filterItemsByDateRange<T extends object>(
  items: T[],
  range: 'today' | '7d' | '30d' | 'all' | 'custom',
  options: {
    dateKey?: string;
    customStart?: Date | undefined;
    customEnd?: Date | undefined;
    timeZone?: string;
  } = {}
): T[] {
  if (range === 'all') return items;

  const { dateKey = 'found_at', customStart, customEnd, timeZone = 'Asia/Kolkata' } = options;
  const now = new Date();
  const todayStr = toKolkataDateStr(now);

  return items.filter((item) => {
    const rawDate = (item as Record<string, unknown>)[dateKey];
    if (rawDate == null || rawDate === '') return false;
    const itemDate = new Date(String(rawDate));
    if (isNaN(itemDate.getTime())) return false;

    if (range === 'today') {
      const itemDateStr = itemDate.toLocaleDateString('en-CA', { timeZone });
      return itemDateStr === todayStr;
    }

    if (range === '7d') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return itemDate >= sevenDaysAgo;
    }

    if (range === '30d') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return itemDate >= thirtyDaysAgo;
    }

    if (range === 'custom') {
      if (customStart && itemDate < customStart) return false;
      if (customEnd && itemDate > customEnd) return false;
      return true;
    }

    return true;
  });
}

export function calculateKpis(
  leads: LeadAnalyticsItem[],
  deals: DealAnalyticsItem[]
): AnalyticsKpis {
  const activeLeads = leads.filter((l) => !l.deleted_at);
  const totalLeads = activeLeads.length;
  const scoredLeads = activeLeads.filter((l) => l.scored).length;

  const usefulLeads = activeLeads.filter((l) =>
    ['acceptable', 'contacted', 'replied', 'won'].includes(l.status)
  ).length;

  const usefulLeadRate = totalLeads > 0
    ? Math.round((usefulLeads / totalLeads) * 1000) / 10
    : 0;

  const contactedCount = activeLeads.filter((l) =>
    ['contacted', 'replied', 'won'].includes(l.status)
  ).length;
  const repliedCount = activeLeads.filter((l) =>
    ['replied', 'won'].includes(l.status)
  ).length;

  const replyRate = contactedCount > 0
    ? Math.round((repliedCount / contactedCount) * 1000) / 10
    : 0;

  const wonCount = activeLeads.filter((l) => l.status === 'won').length;
  const lostCount = activeLeads.filter((l) => l.status === 'lost').length;
  const totalClosed = wonCount + lostCount;

  const winRate = totalClosed > 0
    ? Math.round((wonCount / totalClosed) * 1000) / 10
    : (wonCount > 0 ? 100 : 0);

  let totalPipeline = 0;
  let totalRevenue = 0;
  let wonDealsCount = 0;

  for (const deal of deals) {
    const val = Number(deal.value) || 0;
    totalPipeline += val;
    if (deal.payment_status === 'paid') {
      totalRevenue += val;
    }
    if (deal.completed || deal.payment_status === 'paid') {
      wonDealsCount++;
    }
  }

  return {
    totalLeads,
    scoredLeads,
    usefulLeadRate,
    replyRate,
    winRate,
    totalPipeline,
    totalRevenue,
    wonDealsCount,
  };
}

export function aggregateFunnel(leads: LeadAnalyticsItem[]): FunnelBreakdown {
  const active = leads.filter((l) => !l.deleted_at);
  return {
    newCount: active.filter((l) => l.status === 'new').length,
    acceptableCount: active.filter((l) => l.status === 'acceptable').length,
    contactedCount: active.filter((l) => l.status === 'contacted').length,
    repliedCount: active.filter((l) => l.status === 'replied').length,
    wonCount: active.filter((l) => l.status === 'won').length,
  };
}

export function aggregateLeadsPerDay(
  leads: LeadAnalyticsItem[],
  daysCount = 7,
  timeZone = 'Asia/Kolkata'
): DayBucketItem[] {
  const active = leads.filter((l) => !l.deleted_at);
  const now = new Date();
  const buckets: Record<string, { count: number; webCount: number; mapsCount: number }> = {};

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone });
    buckets[dateStr] = { count: 0, webCount: 0, mapsCount: 0 };
  }

  for (const lead of active) {
    if (!lead.found_at) continue;
    const leadDate = new Date(lead.found_at);
    if (isNaN(leadDate.getTime())) continue;
    const dateStr = leadDate.toLocaleDateString('en-CA', { timeZone });
    if (buckets[dateStr]) {
      buckets[dateStr].count++;
      if (lead.module === 'web') buckets[dateStr].webCount++;
      if (lead.module === 'maps') buckets[dateStr].mapsCount++;
    }
  }

  return Object.entries(buckets).map(([date, data]) => ({
    date,
    count: data.count,
    webCount: data.webCount,
    mapsCount: data.mapsCount,
  }));
}

export function aggregateByAttribute(
  leads: LeadAnalyticsItem[],
  attributeKey: 'source' | 'country' | 'niche',
  maxItems = 6
): CategoryCountItem[] {
  const active = leads.filter((l) => !l.deleted_at);
  const counts: Record<string, number> = {};
  let totalWithAttr = 0;

  for (const lead of active) {
    const rawVal = lead[attributeKey];
    const val = (typeof rawVal === 'string' && rawVal.trim().length > 0)
      ? rawVal.trim()
      : 'Unknown';
    counts[val] = (counts[val] || 0) + 1;
    totalWithAttr++;
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems);

  return sorted.map(([label, count]) => ({
    label,
    count,
    percentage: totalWithAttr > 0 ? Math.round((count / totalWithAttr) * 1000) / 10 : 0,
  }));
}

export function aggregateScoreDistribution(leads: LeadAnalyticsItem[]): ScoreDistribution {
  const active = leads.filter((l) => !l.deleted_at);
  const dist: ScoreDistribution = { low: 0, medium: 0, high: 0, unscored: 0 };

  for (const lead of active) {
    if (!lead.scored || lead.score == null) {
      dist.unscored++;
    } else if (lead.score >= 75) {
      dist.high++;
    } else if (lead.score >= 50) {
      dist.medium++;
    } else {
      dist.low++;
    }
  }

  return dist;
}

export function aggregateAcceptedVsRejected(leads: LeadAnalyticsItem[]): {
  accepted: number;
  rejected: number;
  pending: number;
} {
  const active = leads.filter((l) => !l.deleted_at);
  let accepted = 0;
  let rejected = 0;
  let pending = 0;

  for (const lead of active) {
    if (lead.status === 'rejected') {
      rejected++;
    } else if (['acceptable', 'contacted', 'replied', 'won'].includes(lead.status)) {
      accepted++;
    } else {
      pending++;
    }
  }

  return { accepted, rejected, pending };
}

export function aggregateDealsOverTime(
  deals: DealAnalyticsItem[],
  daysCount = 7,
  timeZone = 'Asia/Kolkata'
): DealRevenueBucket[] {
  const now = new Date();
  const buckets: Record<string, { revenue: number; dealsCount: number }> = {};

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone });
    buckets[dateStr] = { revenue: 0, dealsCount: 0 };
  }

  for (const deal of deals) {
    const dateStr = deal.created_at
      ? new Date(deal.created_at).toLocaleDateString('en-CA', { timeZone })
      : null;
    if (dateStr && buckets[dateStr]) {
      const val = Number(deal.value) || 0;
      buckets[dateStr].dealsCount++;
      if (deal.payment_status === 'paid') {
        buckets[dateStr].revenue += val;
      }
    }
  }

  let runningTotal = 0;
  return Object.entries(buckets).map(([date, data]) => {
    runningTotal += data.revenue;
    return {
      date,
      revenue: data.revenue,
      cumulativeRevenue: runningTotal,
      dealsCount: data.dealsCount,
    };
  });
}
