"use client";

import { AlertCircle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toApiError } from "@/lib/api/error";

export function LoadingState({ label = "Məlumatlar yüklənir…" }: { label?: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground" role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        <span>{label}</span>
      </CardContent>
    </Card>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const apiError = toApiError(error);
  return (
    <Card className="border-destructive/30">
      <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">Məlumatlar yüklənmədi</p>
          <p className="mt-1 text-sm text-muted-foreground">{apiError.message}</p>
          {apiError.requestId ? <p className="mt-1 text-xs text-muted-foreground">Request ID: {apiError.requestId}</p> : null}
        </div>
        {onRetry ? <Button type="button" variant="outline" size="sm" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />Yenidən cəhd</Button> : null}
      </CardContent>
    </Card>
  );
}

export function EmptyState({ title = "Məlumat yoxdur", description }: { title?: string; description?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground/70" aria-hidden="true" />
      <p className="mt-3 font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
