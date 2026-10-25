import { z } from "zod";

export const settingValueTypeSchema = z.enum(["string", "number", "boolean", "json", "null"]);

export const settingsFormSchema = z.object({
  rows: z.array(z.object({
    key: z.string().trim().min(1, "Açar tələb olunur").regex(/^[a-zA-Z0-9_.-]+$/, "Açar yalnız hərf, rəqəm, _ . və - ola bilər"),
    value: z.string(),
    type: settingValueTypeSchema
  }).refine((row) => {
    if (row.type === "number") return row.value.trim() !== "" && Number.isFinite(Number(row.value));
    if (row.type === "boolean") return row.value === "true" || row.value === "false";
    if (row.type === "json") {
      try { const parsed: unknown = JSON.parse(row.value); return typeof parsed === "object" && parsed !== null; } catch { return false; }
    }
    return true;
  }, "Dəyər seçilmiş tipə uyğun deyil")).max(500)
}).refine((data) => new Set(data.rows.map((row) => row.key.trim())).size === data.rows.length, "Təkrar açarlar qadağan edilib");

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
export type SettingValueType = z.infer<typeof settingValueTypeSchema>;
