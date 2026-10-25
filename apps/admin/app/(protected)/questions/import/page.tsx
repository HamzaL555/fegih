"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileSpreadsheet, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/resource-states";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importQuestions, previewQuestionImport } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/error";
import { asNumber, firstString, isRecord } from "@/lib/utils";
import type { ImportFieldError, ImportPreview, ImportRowResult } from "@/types/admin";

const ACCEPTED_TYPES = [".json", "application/json"];

function fieldErrorsFrom(value: unknown): ImportFieldError[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [{ field: "sətir", message: item }];
    if (!isRecord(item)) return [];
    return [{
      field: firstString(item.field, item.column, item.path) || "sətir",
      message: firstString(item.message, item.error) || "Naməlum xəta"
    }];
  });
}

function normalizePreview(payload: unknown): ImportPreview {
  const root = isRecord(payload) ? payload : {};
  const rawRows = Array.isArray(root.rows)
    ? root.rows
    : Array.isArray(root.preview)
      ? root.preview
      : Array.isArray(root.data)
        ? root.data
        : Array.isArray(root.errors)
          ? root.errors
          : [];

  const rows: ImportRowResult[] = rawRows.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const rowNumber = asNumber(item.row ?? item.rowNumber ?? ((item.itemIndex !== undefined ? Number(item.itemIndex) + 1 : index + 1)), index + 1);
    const nestedErrors = fieldErrorsFrom(item.fieldErrors ?? item.errors ?? item.validationErrors ?? (item.field ? [item] : []));
    const rowError = firstString(item.message, item.error);
    const explicitValid = typeof item.valid === "boolean" ? item.valid : undefined;
    const valid = explicitValid ?? (nestedErrors.length === 0 && !rowError);
    return [{
      row: rowNumber,
      valid,
      fieldErrors: nestedErrors,
      message: rowError || null,
      raw: item.data ?? item.rowData ?? item
    }];
  });

  const topLevelErrors = Array.isArray(root.errors) && rawRows !== root.errors ? root.errors : [];
  for (const item of topLevelErrors) {
    if (!isRecord(item)) continue;
    const row = asNumber(item.row ?? item.rowNumber ?? item.itemIndex, 0) + 1;
    const target = rows.find((entry) => entry.row === row);
    const errors = fieldErrorsFrom([item]);
    if (target) {
      target.valid = false;
      target.fieldErrors.push(...errors);
    }
  }

  const total = asNumber(root.total ?? root.totalRows, rows.length);
  const valid = asNumber(root.valid ?? root.validRows ?? root.validCount, rows.filter((row) => row.valid).length);
  const invalid = asNumber(root.invalid ?? root.invalidRows ?? root.invalidCount, Math.max(0, total - valid));
  return { rows, total, valid, invalid };
}

export default function QuestionImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [imported, setImported] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewMutation = useMutation({
    mutationFn: previewQuestionImport,
    onSuccess: (data) => { setPreview(normalizePreview(data)); setImported(false); }
  });
  const importMutation = useMutation({
    mutationFn: importQuestions,
    onSuccess: () => setImported(true)
  });

  const selectFile = (selected: File | null) => {
    setPreview(null);
    setImported(false);
    setFileError(null);
    previewMutation.reset();
    importMutation.reset();
    if (!selected) { setFile(null); return; }
    const extensionAllowed = ACCEPTED_TYPES.some((type) => type.startsWith(".") && selected.name.toLowerCase().endsWith(type));
    if (!extensionAllowed && selected.type !== "application/json") {
      setFile(null);
      setFileError("Yalnız JSON fayl seçin.");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setFile(null);
      setFileError("Faylın ölçüsü 10 MB-dan çox ola bilməz.");
      return;
    }
    setFile(selected);
  };

  const runPreview = () => {
    if (!file) return;
    previewMutation.mutate(file, { onError: () => setPreview(null) });
  };
  const runImport = () => {
    if (!file) return;
    importMutation.mutate(file);
  };

  return (
    <div>
      <PageHeader title="Sual idxalı" description="JSON faylı seçin, serverdə önizləmə nəticələrini yoxlayın və idxalı tamamlayın" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader><CardTitle>1. Fayl seçin</CardTitle><CardDescription>Fayl birbaşa API-yə göndərilir; lokal biznes məlumatı saxlanmır.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {fileError ? <Alert variant="error">{fileError}</Alert> : null}
            <div className="space-y-2">
              <Label htmlFor="import-file">JSON fayl</Label>
              <Input
                ref={inputRef}
                id="import-file"
                type="file"
                accept=".json,application/json"
                aria-describedby="import-file-help"
                onChange={(event) => selectFile(event.target.files?.[0] || null)}
              />
              <p id="import-file-help" className="text-xs text-muted-foreground">Maksimum ölçü: 10 MB.</p>
            </div>
            {file ? (
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><FileSpreadsheet className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p></div>
              </div>
            ) : null}
            <Button className="w-full" onClick={runPreview} disabled={!file || previewMutation.isPending}>
              <UploadCloud className="mr-2 h-4 w-4" />{previewMutation.isPending ? "Yoxlanılır…" : "Önizləmə et"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {previewMutation.isError ? <Alert variant="error">{toApiError(previewMutation.error).message}</Alert> : null}
          {importMutation.isError ? <Alert variant="error">{toApiError(importMutation.error).message}</Alert> : null}
          {imported ? <Alert variant="success">Idxal sorğusu API tərəfindən uğurla qəbul edildi.</Alert> : null}

          {preview ? (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><CardTitle>2. Önizləmə nəticələri</CardTitle><CardDescription>Satır və sahə səviyyəsindəki xətaları yoxlayın.</CardDescription></div>
                  <Button onClick={runImport} disabled={importMutation.isPending || preview.total === 0}>
                    <UploadCloud className="mr-2 h-4 w-4" />{importMutation.isPending ? "İdxal olunur…" : "İdxal et"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-5 grid grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Ümumi</p><p className="mt-1 text-xl font-semibold">{preview.total}</p></div>
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3"><p className="text-xs text-muted-foreground">Etibarlı</p><p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-300">{preview.valid}</p></div>
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"><p className="text-xs text-muted-foreground">Xətalı</p><p className="mt-1 text-xl font-semibold text-destructive">{preview.invalid}</p></div>
                </div>
                {preview.rows.length ? (
                  <div className="space-y-3">
                    {preview.rows.map((row) => (
                      <div key={row.row} className={`rounded-lg border p-4 ${row.valid ? "border-emerald-500/30" : "border-destructive/40 bg-destructive/5"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">Sətir {row.row}</p>
                          <Badge variant={row.valid ? "success" : "destructive"}>{row.valid ? <><CheckCircle2 className="mr-1 h-3 w-3" />Etibarlı</> : <><AlertCircle className="mr-1 h-3 w-3" />Xətalı</>}</Badge>
                        </div>
                        {row.message ? <p className="mt-2 text-sm text-destructive">{row.message}</p> : null}
                        {row.fieldErrors.length ? (
                          <ul className="mt-2 space-y-1 text-sm text-destructive">
                            {row.fieldErrors.map((error, index) => <li key={`${error.field}-${index}`}><strong>{error.field}:</strong> {error.message}</li>)}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : <EmptyState title="Sətir nəticəsi qaytarılmadı" description="Server ümumi sayı göstərdi, lakin sətir detallarını qaytarmadı." />}
              </CardContent>
            </Card>
          ) : !previewMutation.isPending ? (
            <Card><CardContent className="p-5"><EmptyState title="Önizləmə gözlənilir" description="Fayl seçib önizləmə etdikdən sonra hər sətir üçün nəticə burada görünəcək." /></CardContent></Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
