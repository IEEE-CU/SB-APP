export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'DUPLICATE_RESOURCE'
  | 'INVALID_STATE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';
