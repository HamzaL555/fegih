"use client";

import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/resource-states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { settingsApi } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/error";
import { queryKeys } from "@/lib/query/keys";
import { isRecord } from "@/lib/utils";
import { settingsFormSchema, type SettingsFormValues, type SettingValueType } from "@/schemas/settings";

type SettingRow = SettingsFormValues["rows"][number];

function toRows(value: unknown): SettingRow[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).map(([key, raw], index) => {
    if (raw === null) return { key, type: "null", value: "" };
    if (Array.isArray(raw) || isRecord(raw)) return { key, type: "json", value: JSON.stringify(raw, null, 2) };
    if (typeof raw === "number") return { key, type: "number", value: String(raw) };
    if (typeof raw === "boolean") return { key, type: "boolean", value: String(raw) };
    return { key, type: "string", value: String(raw) };
  });
}

function fromRows(rows: SettingRow[]): Record<string, unknown> {
  return Object.fromEntries(rows.map((row) => {
    const key = row.key.trim();
    if (row.type === "null") return [key, null];
    if (row.type === "number") return [key, Number(row.value)];
    if (row.type === "boolean") return [key, row.value === "true"];
    if (row.type === "json") return [key, JSON.parse(row.value)];
    return [key, row.value];
  }));
}

export function SettingsForm() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.settings, queryFn: settingsApi.get });
  const form = useForm<SettingsFormValues>({ resolver: zodResolver(settingsFormSchema), defaultValues: { rows: [] } });
  const fields = useFieldArray({ control: form.control, name: "rows" });
  const mutation = useMutation({ mutationFn: settingsApi.update, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.settings }) });

  useEffect(() => {
    if (query.data !== undefined) {
      const value = isRecord(query.data) && isRecord(query.data.settings) ? query.data.settings : query.data;
      form.reset({ rows: toRows(value) });
    }
  }, [form, query.data]);

  const submit = form.handleSubmit((values) => mutation.mutate(fromRows(values.rows)));
  if (query.isPending) return <LoadingState label="Tənzimləmələr yüklənir…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <form onSubmit={submit} className="space-y-5" noValidate>
    {mutation.isError ? <Alert variant="error">{toApiError(mutation.error).message}</Alert> : null}
    {mutation.isSuccess ? <Alert variant="success">Tənzimləmələr yeniləndi.</Alert> : null}
    <div className="flex items-center justify-between"><div><p className="font-medium">Tənzimləmə açarları</p><p className="text-sm text-muted-foreground">Hər sətir dəyər seçilmiş tipə çevrilib API-yə obyekt göndərilir.</p></div><Button type="button" variant="outline" size="sm" onClick={() => fields.append({ key: "", type: "string", value: "" })} disabled={fields.fields.length >= 500}><Plus className="mr-1 h-4 w-4" />Açar</Button></div>
    {fields.fields.length === 0 ? <EmptyState title="Tənzimləmə yoxdur" description="Server boş obyekt qaytardı. Yeni açar əlavə etmək üçün düymədən istifadə edin." /> : <div className="space-y-3">{fields.fields.map((field, index) => {
      const rowError = form.formState.errors.rows?.[index];
      return <div key={field.id} className="rounded-lg border border-border p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
          <div className="space-y-1"><Label htmlFor={`setting-key-${field.id}`} className="sr-only">Açar</Label><Input id={`setting-key-${field.id}`} placeholder="setting_key" aria-invalid={Boolean(rowError?.key)} {...form.register(`rows.${index}.key`)} />{rowError?.key?.message ? <p className="text-xs text-destructive">{rowError.key.message}</p> : null}</div>
          <div><Label htmlFor={`setting-type-${field.id}`} className="sr-only">Tip</Label><Select id={`setting-type-${field.id}`} {...form.register(`rows.${index}.type`)}>{(["string", "number", "boolean", "json", "null"] as SettingValueType[]).map((type) => <option key={type} value={type}>{type}</option>)}</Select></div>
          <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => fields.remove(index)} aria-label="Tənzimləməni sil"><Trash2 className="h-4 w-4" /></Button>
        </div>
        {form.watch(`rows.${index}.type`) !== "null" ? <div className="mt-3"><Label htmlFor={`setting-value-${field.id}`} className="sr-only">Dəyər</Label>{form.watch(`rows.${index}.type`) === "json" ? <Textarea id={`setting-value-${field.id}`} rows={4} className="font-mono text-xs" {...form.register(`rows.${index}.value`)} /> : form.watch(`rows.${index}.type`) === "boolean" ? <Select id={`setting-value-${field.id}`} {...form.register(`rows.${index}.value`)}><option value="true">true</option><option value="false">false</option></Select> : <Input id={`setting-value-${field.id}`} type={form.watch(`rows.${index}.type`) === "number" ? "number" : "text"} step="any" {...form.register(`rows.${index}.value`)} />}{rowError?.value?.message || rowError?.message ? <p className="mt-1 text-xs text-destructive">{rowError?.value?.message || rowError?.message}</p> : null}</div> : null}
      </div>;
    })}</div>}
    <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Tənzimləmələri saxla</Button>
  </form>;
}
