const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_BASE_URL = (configuredApiUrl || "/api/v1").replace(/\/+$/, "");
export const APP_NAME = "Fegih Admin";
