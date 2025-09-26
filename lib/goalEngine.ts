// lib/goalEngine.ts
export type Impact = 'High' | 'Medium' | 'Low';

export interface AnalyticsSnapshot {
  // Use the same window as your ?days param
  days: number;
  totals: {
    totalUsers: number;
    newUsers: number;
    sessions: number;
    conversions: number;                // GA4: key conversion event count
    conversionRate: number;             // conversions / sessions
    engagementRate: number;             // GA4 metric (0..1)
    avgSessionDurationSec: number;
    bounceRate: number;                 // GA4 metric (0..1)
    returningUsers?: number;            // optional
    pagesPerSession?: number;
  };
  breakdowns?: {
    topLandingPages?: Array<{ path: string; sessions: number; bounceRate: number; convRate: number }>;
    topCountries?: Array<{ code: string; country: string; users: number }>;
    age?: Array<{ bucket: string; users: number }>;
    gender?: Array<{ bucket: string; users: number }>;
    interests?: Array<{ bucket: string; users: number }>;
  };
  gbp?: {
    // From Business Profile Performance API (if connected)
    calls?: number;
    callsPrev?: number;
    websiteClicks?: number;
    directionRequests?: number;
    reviews?: number;
    avgRating?: number;
    responseRate?: number; // 0..1
  };
}

export interface SuggestedGoal {
  name: string;
  type: 'engagement' | 'conversion' | 'retention' | 'content' | 'seo' | 'local' | 'reviews' | 'speed';
  target: number;
  current: number;
  unit: 'pct' | 'count' | 'sec';
  timeframeDays: number;
  description: string;
  impact: Impact;
  rationale: string;
  // optional metadata you can hide in UI
  meta?: Record<string, unknown>;
}

/** Simple helper: percent delta */
const pctDelta = (curr: number, target: number) =>
  curr === 0 ? 100 : ((target - curr) / Math.max(curr, 1)) * 100;

/** Compute a status label vs a naive linear schedule */
export function statusFromProgress(current: number, target: number, elapsedRatio: number): 'exceeding'|'on-track'|'at-risk'|'behind' {
  const progress = target === 0 ? 1 : current / target;
  const aheadBy = progress - elapsedRatio;
  if (aheadBy >= 0.15) return 'exceeding';
  if (aheadBy >= -0.05) return 'on-track';
  if (aheadBy >= -0.15) return 'at-risk';
  return 'behind';
}

/** Core rule-based recommender */
export function buildSuggestedGoals(s: AnalyticsSnapshot): SuggestedGoal[] {
  const out: SuggestedGoal[] = [];
  const t = s.totals;
  const timeframe = s.days;

  // 1) Engagement rate goal
  if (t.engagementRate < 0.55) {
    const target = Math.min(0.60, +(t.engagementRate * 1.10).toFixed(4));
    out.push({
      name: 'Increase engagement rate',
      type: 'engagement',
      target,
      current: t.engagementRate,
      unit: 'pct',
      timeframeDays: timeframe,
      description: 'Improve onsite engagement through clearer CTAs and tighter above-the-fold content.',
      impact: 'High',
      rationale: `Current engagement ${(t.engagementRate*100).toFixed(1)}%. Target ${(target*100).toFixed(1)}% (+${pctDelta(t.engagementRate, target).toFixed(1)}%).`
    });
  }

  // 2) Bounce rate on top landing page
  const lp = s.breakdowns?.topLandingPages?.find(x => x.sessions >= 100 && x.bounceRate > 0.6);
  if (lp) {
    const target = Math.max(0.50, +(lp.bounceRate - 0.10).toFixed(4));
    out.push({
      name: `Reduce bounce on ${lp.path}`,
      type: 'content',
      target,
      current: lp.bounceRate,
      unit: 'pct',
      timeframeDays: timeframe,
      description: 'Tighten headline, add social proof, add primary CTA. Consider matching ad keywords to headline.',
      impact: 'High',
      rationale: `Bounce ${(lp.bounceRate*100).toFixed(0)}% on ${lp.sessions} sessions. Aim ${(target*100).toFixed(0)}%.`
    });
  }

  // 3) Conversion rate lift
  if (t.conversionRate < 0.04) {
    const target = +(Math.min(0.05, t.conversionRate * 1.25)).toFixed(4);
    out.push({
      name: 'Lift sitewide conversion rate',
      type: 'conversion',
      target,
      current: t.conversionRate,
      unit: 'pct',
      timeframeDays: timeframe,
      description: 'Improve form UX, shorten steps, add trust badges, reduce distractions on key pages.',
      impact: 'High',
      rationale: `Current ${(t.conversionRate*100).toFixed(1)}%. Target ${(target*100).toFixed(1)}% (+${pctDelta(t.conversionRate, target).toFixed(1)}%).`
    });
  }

  // 4) Returning user share
  if (typeof s.totals.returningUsers === 'number' && t.totalUsers > 0) {
    const share = s.totals.returningUsers / t.totalUsers;
    if (share < 0.30) {
      const targetShare = Math.min(0.35, +(share * 1.20).toFixed(4));
      out.push({
        name: 'Grow returning users',
        type: 'retention',
        target: targetShare,
        current: share,
        unit: 'pct',
        timeframeDays: timeframe,
        description: 'Add email capture, remarketing, and content cadence that brings people back.',
        impact: 'Medium',
        rationale: `Returning share ${(share*100).toFixed(1)}%. Goal ${(targetShare*100).toFixed(1)}%.`
      });
    }
  }

  // 5) Local goals (GBP)
  if (s.gbp?.calls != null && s.gbp?.callsPrev != null) {
    const curr = s.gbp.calls;
    const target = Math.round(curr * 1.20);
    out.push({
      name: 'Increase calls from Google',
      type: 'local',
      target,
      current: curr,
      unit: 'count',
      timeframeDays: timeframe,
      description: 'Improve GBP: fresh photos, recent posts, Q&A answers, more reviews, updated services.',
      impact: 'High',
      rationale: `Calls ${curr} in period. Target ${target} (+20%).`
    });
  }

  if (s.gbp?.reviews != null && s.gbp?.avgRating != null) {
    if (s.gbp.avgRating < 4.7) {
      out.push({
        name: 'Get new 5-star reviews',
        type: 'reviews',
        target: (s.gbp.reviews ?? 0) + 10,
        current: s.gbp.reviews ?? 0,
        unit: 'count',
        timeframeDays: timeframe,
        description: 'Request reviews by text after service and reply to all recent reviews.',
        impact: 'Medium',
        rationale: `Avg rating ${s.gbp.avgRating.toFixed(1)}. +10 fresh reviews can lift rank and conversions.`
      });
    }
  }

  // 6) Site speed proxy via high bounce (optional)
  if (t.bounceRate > 0.55 && (t.pagesPerSession ?? 1.0) < 1.4) {
    out.push({
      name: 'Reduce bounce through speed',
      type: 'speed',
      target: Math.max(0.48, +(t.bounceRate - 0.07).toFixed(4)),
      current: t.bounceRate,
      unit: 'pct',
      timeframeDays: timeframe,
      description: 'Compress images, lazy-load below the fold, limit third-party scripts.',
      impact: 'Medium',
      rationale: `Bounce ${(t.bounceRate*100).toFixed(0)}% with low depth. Aim -7 pts.`
    });
  }

  return out;
}
