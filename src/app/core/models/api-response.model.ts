/**
 * Generic API response matching backend/utils/response.js
 * { success: boolean; message: string; data: T }
 */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  /** Set when ADMIN creates a GRN that was auto-posted to inventory. */
  autoPosted?: boolean;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    skip?: number;
    take?: number;
  };
}
