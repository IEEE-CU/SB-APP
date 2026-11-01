import api from "@/lib/api";
import type { ApiResponse } from "@/types/api";

// AUD-013: the Gemini key lives on the server. This only asks the backend for the audit; the
// backend reads the figures itself, within the caller's scope, and returns the generated text.
export const getFinancialInsights = async (targetSocietyId?: string): Promise<string> => {
  try {
    const res = await api.post<ApiResponse<{ insights: string }>>(
      "/ai/financial-insights",
      targetSocietyId ? { societyId: targetSocietyId } : {},
    );
    return res.data.data.insights || "Unable to generate insights at this time.";
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 403) return "You do not have permission to run the AI audit.";
    if (status === 429) return "Too many AI audit requests. Please try again later.";
    if (status === 503) return "The AI audit is not available right now.";
    return "Error connecting to AI service.";
  }
};
