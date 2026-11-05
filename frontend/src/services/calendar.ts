import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";
import type { UnifiedCalendarEvent } from "@/types/models";
import { activeSocietyId } from "@/lib/backendPayload";

export const calendarService = {
  getUnifiedEvents: (start?: string, end?: string, societyId?: string) =>
    api.get<ApiResponse<UnifiedCalendarEvent[]>>("/calendar/unified", {
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
    time?: string;
    venue?: string;
    societyId?: string;
  }) =>
    api.post<ApiResponse<UnifiedCalendarEvent>>("/calendar", {
      title: data.title,
      description: data.description || data.title,
      date: data.date,
      time: data.time,
      venue: data.venue,
      societyId: data.societyId || activeSocietyId(),
    }),
};
