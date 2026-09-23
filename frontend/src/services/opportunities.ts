import api from '@/lib/api';
import type { ApiResponse } from '@/types/api';

export interface OpportunitySociety {
  society: string;
  label: string;
  url: string;
}

export interface Opportunity {
  id: string;
  society: string;
  title: string;
  link: string;
  sourceUrl: string;
  scrapedAt: string;
}

export const opportunityService = {
  getSocieties: () =>
    api.get<ApiResponse<OpportunitySociety[]>>('/opportunities/societies'),
  getOpportunities: (society: string) =>
    api.get<ApiResponse<Opportunity[]> & { fallbackUrl: string | null }>(
      '/opportunities',
      { params: { society } },
    ),
};
