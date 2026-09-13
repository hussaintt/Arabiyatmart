export interface DashboardWindow {
  days: number;
  startAt: string;
}

export interface DashboardSummary {
  activeListingsCount: number;
  totalViews: number;
  totalLeads: number;
  leadsByChannel: Record<string, number>;
  totalFavorites: number;
  responseRatePercentage: number;
}

export interface DashboardOverview {
  window: DashboardWindow;
  summary: DashboardSummary;
}

export interface DashboardOverviewResponse {
  data: DashboardOverview;
}

export type DashboardRange = '7d' | '30d' | '90d';

export interface DashboardRangeParams {
  range: DashboardRange;
  vendorPublicId: string;
}
