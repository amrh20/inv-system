/**
 * Generic API response matching backend/utils/response.js
 * { success: boolean; message: string; data: T }
 */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    skip?: number;
    take?: number;
  };
}
