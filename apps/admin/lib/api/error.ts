import axios from "axios";
import type { ApiErrorBody } from "@/types/api";
import { isRecord } from "@/lib/utils";

export class ApiError extends Error {
  code: string;
  status?: number;
  details?: unknown;
  requestId?: string;

  constructor(message: string, code = "UNKNOWN_ERROR", status?: number, details?: unknown, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;
    let apiError: ApiErrorBody | undefined;
    if (isRecord(payload) && isRecord(payload.error)) {
      apiError = payload.error as unknown as ApiErrorBody;
    }
    return new ApiError(
      apiError?.message || error.message || "Sorğu zamanı xəta baş verdi",
      apiError?.code || error.code || "REQUEST_FAILED",
      error.response?.status,
      apiError?.details,
      apiError?.requestId
    );
  }

  return error instanceof Error
    ? new ApiError(error.message)
    : new ApiError("Naməlum xəta baş verdi");
}
