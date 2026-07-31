import api from '@/lib/api';
import type { ApiResponse } from '@/types/api';
import type { UnifiedCalendarEvent } from '@/types/models';

export const calendarService = {
  getUnifiedEvents: (start?: string, end?: string, societyId?: string) =>
    api.get<ApiResponse<UnifiedCalendarEvent[]>>('/calendar/unified', {
      params: {
        start,
        end,
        societyId,
      },
    }),
  
  createEvent: (data: {
    title: string;
    description?: string;
    date: string;
    endDate?: string;
    location?: string;
    sourceType?: string;
    metadata?: Record<string, any>;
  }) =>
    api.post<ApiResponse<UnifiedCalendarEvent>>('/calendar', data),
};
