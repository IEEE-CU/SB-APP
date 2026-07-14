import api from '@/lib/api';
import type { ApiResponse } from '@/types/api';
import type { UnifiedCalendarEvent } from '@/types/models';

export const calendarService = {
  getUnifiedEvents: (startDate?: string, endDate?: string, sourceTypes?: string[]) =>
    api.get<ApiResponse<UnifiedCalendarEvent[]>>('/calendar/unified', {
      params: {
        startDate,
        endDate,
        sourceTypes: sourceTypes?.join(','),
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
