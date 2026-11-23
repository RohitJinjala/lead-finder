import { describe, it, expect } from 'vitest';
import {
  calculateKpis,
  aggregateFunnel,
  aggregateLeadsPerDay,
  aggregateByAttribute,
  aggregateScoreDistribution,
  aggregateAcceptedVsRejected,
  aggregateDealsOverTime,
  filterLeadsByModule,
  filterItemsByDateRange,
  type LeadAnalyticsItem,
  type DealAnalyticsItem,
} from '../analytics.js';

// Helpers: generate dates relative to now so tests never go stale
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}
function daysAgoAt(n: number, h: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
}

describe('analytics module', () => {
  const mockLeads: LeadAnalyticsItem[] = [
    {
      id: '1',
      lead_code: 'WEB-0001',
      module: 'web',
      source: 'hackernews',
      found_at: daysAgo(1),
      status: 'new',
      scored: true,
      score: 85,
      country: 'United States',
      niche: 'SaaS',
    },
    {
      id: '2',
      lead_code: 'WEB-0002',
      module: 'web',
      source: 'reddit',
      found_at: daysAgoAt(1, 11),
      status: 'acceptable',
      scored: true,
      score: 72,
      country: 'Canada',
      niche: 'E-commerce',
    },
    {
      id: '3',
      lead_code: 'MAP-0001',
      module: 'maps',
      source: 'overpass',
      found_at: daysAgo(2),
      status: 'contacted',
      scored: true,
      score: 65,
      country: 'India',
      niche: 'Dental Clinic',
    },
    {
      id: '4',
      lead_code: 'MAP-0002',
      module: 'maps',
      source: 'overpass',
      found_at: daysAgoAt(2, 12),
      status: 'won',
      scored: true,
      score: 95,
      country: 'United States',
      niche: 'Roofing',
    },
    {
      id: '5',
      lead_code: 'WEB-0003',
      module: 'web',
      source: 'hackernews',
      found_at: daysAgo(3),
      status: 'rejected',
      reject_reason: 'low budget',
      scored: true,
      score: 25,
      country: 'United Kingdom',
      niche: 'Design',
    },
    {
      id: '6',
      lead_code: 'WEB-0004',
      module: 'web',
      source: 'remoteok',
      found_at: daysAgo(5),
      status: 'new',
      scored: false,
      score: null,
      country: null,
      niche: null,
      deleted_at: daysAgo(4), // deleted, should be excluded
    },
  ];

  const mockDeals: DealAnalyticsItem[] = [
    {
      id: 'd1',
      lead_code: 'MAP-0002',
      value: 1500,
      currency: 'USD',
      payment_status: 'paid',
      completed: true,
      created_at: daysAgoAt(2, 14),
    },
    {
      id: 'd2',
      lead_code: 'WEB-0002',
      value: 3000,
      currency: 'USD',
      payment_status: 'unpaid',
      completed: false,
      created_at: daysAgoAt(1, 12),
    },
  ];

  it('calculates KPIs correctly excluding deleted leads', () => {
    const kpis = calculateKpis(mockLeads, mockDeals);
    // Active leads: 5 (1 deleted)
    expect(kpis.totalLeads).toBe(5);
    expect(kpis.scoredLeads).toBe(5);
    // Useful leads: acceptable (1), contacted (1), won (1) -> 3 out of 5 = 60.0%
    expect(kpis.usefulLeadRate).toBe(60);
    // Contacted funnel: contacted (1), won (1) = 2. Won counts as replied -> 100%
    expect(kpis.replyRate).toBe(50); // replied/won count: won(1), total contacted: 2 -> 50%
    // Win rate: won=1, lost=0 -> 100%
    expect(kpis.winRate).toBe(100);
    // Pipeline and Revenue
    expect(kpis.totalPipeline).toBe(4500);
    expect(kpis.totalRevenue).toBe(1500);
    expect(kpis.wonDealsCount).toBe(1);
  });

  it('aggregates funnel status accurately', () => {
    const funnel = aggregateFunnel(mockLeads);
    expect(funnel.newCount).toBe(1);
    expect(funnel.acceptableCount).toBe(1);
    expect(funnel.contactedCount).toBe(1);
    expect(funnel.repliedCount).toBe(0);
    expect(funnel.wonCount).toBe(1);
  });

  it('aggregates leads per day buckets', () => {
    const buckets = aggregateLeadsPerDay(mockLeads, 7, 'Asia/Kolkata');
    expect(buckets.length).toBe(7);
    const totalCount = buckets.reduce((acc, b) => acc + b.count, 0);
    expect(totalCount).toBe(5);
  });

  it('aggregates attributes by source, country, niche', () => {
    const sources = aggregateByAttribute(mockLeads, 'source');
    expect(sources.length).toBeGreaterThan(0);
    const hn = sources.find((s) => s.label === 'hackernews');
    expect(hn?.count).toBe(2);

    const countries = aggregateByAttribute(mockLeads, 'country');
    const us = countries.find((c) => c.label === 'United States');
    expect(us?.count).toBe(2);

    const niches = aggregateByAttribute(mockLeads, 'niche');
    expect(niches.length).toBeGreaterThan(0);
  });

  it('aggregates score distribution into low, medium, high, unscored', () => {
    const dist = aggregateScoreDistribution(mockLeads);
    // Active leads:
    // 85 (high)
    // 72 (medium)
    // 65 (medium)
    // 95 (high)
    // 25 (low)
    expect(dist.high).toBe(2);
    expect(dist.medium).toBe(2);
    expect(dist.low).toBe(1);
    expect(dist.unscored).toBe(0);
  });

  it('aggregates accepted vs rejected vs pending', () => {
    const res = aggregateAcceptedVsRejected(mockLeads);
    expect(res.accepted).toBe(3); // acceptable, contacted, won
    expect(res.rejected).toBe(1); // rejected
    expect(res.pending).toBe(1);  // new
  });

  it('aggregates deal revenue over time', () => {
    const timeBuckets = aggregateDealsOverTime(mockDeals, 7, 'Asia/Kolkata');
    expect(timeBuckets.length).toBe(7);
    const lastBucket = timeBuckets[timeBuckets.length - 1];
    expect(lastBucket?.cumulativeRevenue).toBe(1500);
  });

  it('filters leads by module and date range', () => {
    const webOnly = filterLeadsByModule(mockLeads, 'web');
    expect(webOnly.every((l) => l.module === 'web')).toBe(true);

    const mapsOnly = filterLeadsByModule(mockLeads, 'maps');
    expect(mapsOnly.every((l) => l.module === 'maps')).toBe(true);

    const filtered7d = filterItemsByDateRange(mockLeads, '7d');
    expect(filtered7d.length).toBe(6); // all occurred within 7 days
  });
});
