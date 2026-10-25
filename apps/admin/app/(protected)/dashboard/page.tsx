"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, CircleGauge, PieChart as PieChartIcon, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/resource-states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/lib/api/admin";
import { normalizeDashboard } from "@/lib/format";
import { queryKeys } from "@/lib/query/keys";
import { toDateLabel } from "@/lib/utils";
import type { ChartDatum } from "@/types/admin";

const chartColors = ["#0f766e", "#d4a72c", "#0f766e", "#d4a72c", "#64748b", "#0d9488"];

function ActivityChart({ data }: { data: ChartDatum[] }) {
  return (
    <div className="h-72 w-full" aria-label="Fəaliyyət qrafiki">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -20, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "rgba(15, 118, 110, 0.08)" }} />
          <Bar dataKey="value" name="Fəaliyyət" fill="#0f766e" radius={[6, 6, 0, 0]} maxBarSize={52} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DistributionChart({ data }: { data: ChartDatum[] }) {
  return (
    <div className="h-72 w-full" aria-label="Paylanma qrafiki">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} isAnimationActive={false}>
            {data.map((entry, index) => <Cell key={`${entry.label}-${index}`} fill={chartColors[index % chartColors.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DashboardPage() {
  const query = useQuery({ queryKey: queryKeys.dashboard, queryFn: getDashboard });
  const data = query.data ? normalizeDashboard(query.data) : null;

  return (
    <div>
      <PageHeader title="İdarəetmə paneli" description="API-dən gələn canlı əməliyyat və statistik məlumatlar" />
      {query.isPending ? <DashboardSkeleton /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.isSuccess && data ? (
        data.stats.length === 0 && data.activity.length === 0 && data.distribution.length === 0 && data.recentActivity.length === 0 ? (
          <Card><CardContent className="p-5"><EmptyState title="Statistika mövcud deyil" description="Hələ API-dən göstərilə bilən statistik məlumat qaytarılmayıb." /></CardContent></Card>
        ) : (
          <div className="space-y-6">
            {data.stats.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {data.stats.map((stat) => (
                  <Card key={stat.label} className="overflow-hidden">
                    <CardContent className="flex items-center justify-between p-5">
                      <div><p className="text-sm text-muted-foreground">{stat.label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{new Intl.NumberFormat("az-AZ").format(stat.value)}</p></div>
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Activity className="h-5 w-5" /></span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Fəaliyyət</CardTitle><CardDescription>Serverdən gələn müqayisəli qrafik</CardDescription></CardHeader>
                <CardContent>{data.activity.length ? <ActivityChart data={data.activity} /> : <EmptyState title="Qrafik məlumatı yoxdur" />}</CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-primary" />Paylanma</CardTitle><CardDescription>API-dən gələn paylanma</CardDescription></CardHeader>
                <CardContent>{data.distribution.length ? <DistributionChart data={data.distribution} /> : <EmptyState title="Paylanma məlumatı yoxdur" />}</CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Son fəaliyyət</CardTitle><CardDescription>Son əməliyyatlar serverdən göstərilir</CardDescription></CardHeader>
              <CardContent>
                {data.recentActivity.length ? (
                  <div className="divide-y divide-border">
                    {data.recentActivity.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                        <div><p className="font-medium">{item.label}</p>{item.detail ? <p className="text-sm text-muted-foreground">{item.detail}</p> : null}</div>
                        <span className="shrink-0 text-xs text-muted-foreground">{toDateLabel(item.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState title="Son fəaliyyət yoxdur" />}
              </CardContent>
            </Card>
          </div>
        )
      ) : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Dashboard yüklənir">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)}</div>
      <div className="grid gap-6 xl:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
    </div>
  );
}
