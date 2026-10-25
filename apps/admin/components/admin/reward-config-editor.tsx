"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/admin/resource-states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rewardApi, type RewardConfig } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/error";
import { queryKeys } from "@/lib/query/keys";
import { rewardJsonSchema, type RewardJsonFormValues } from "@/schemas/reward";

type Resource = "question-levels" | "lifelines" | "first-login" | "daily-rewards" | "point-discounts";

export function RewardConfigEditor({ resource, title, description }: { resource: Resource; title: string; description: string }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.reward(resource), queryFn: () => rewardApi.get(resource) });
  const form = useForm<RewardJsonFormValues>({ resolver: zodResolver(rewardJsonSchema), defaultValues: { json: "{}" } });

  useEffect(() => {
    if (query.data !== undefined) form.reset({ json: JSON.stringify(query.data, null, 2) });
  }, [form, query.data]);

  const mutation = useMutation({
    mutationFn: (payload: RewardConfig) => rewardApi.update(resource, payload),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.reward(resource) })
  });

  const submit = form.handleSubmit((values) => mutation.mutate(JSON.parse(values.json)));
  return <Card>
    <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
    <CardContent>
      {query.isPending ? <LoadingState label="Konfiqurasiya yüklənir…" /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.isSuccess ? <form onSubmit={submit} className="space-y-4" noValidate>
        {mutation.isError ? <Alert variant="error">{toApiError(mutation.error).message}</Alert> : null}
        {mutation.isSuccess ? <Alert variant="success">Konfiqurasiya yeniləndi.</Alert> : null}
        <div className="space-y-2"><Label htmlFor={`${resource}-json`}>JSON konfiqurasiyası</Label><Textarea id={`${resource}-json`} rows={12} spellCheck={false} className="font-mono text-xs" aria-invalid={Boolean(form.formState.errors.json)} {...form.register("json")} /><p className="text-xs text-muted-foreground">Sorğu göndəriləndə bu JSON dəyişmədən serverə ötürülür.</p>{form.formState.errors.json ? <p className="text-sm text-destructive">{form.formState.errors.json.message}</p> : null}</div>
        <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting || mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Yenilə</Button>
      </form> : null}
    </CardContent>
  </Card>;
}
