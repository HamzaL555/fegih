"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CreditCard, Loader2, Save, Search, Truck } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/resource-states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ordersApi } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/error";
import { queryKeys } from "@/lib/query/keys";
import { toCurrency, toDateLabel } from "@/lib/utils";
import type { Order } from "@/types/admin";

const LIMIT = 20;

/** Human label + icon for the three ways an order can be paid. */
const PAYMENT_META: Record<string, { label: string; icon: typeof CreditCard; tone: string }> = {
  CARD: { label: "Kartla", icon: CreditCard, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  CASH_ON_DELIVERY: { label: "Nağd (kuryer)", icon: Truck, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  BANK_TRANSFER: { label: "Bank köçürməsi", icon: Banknote, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
};

function PaymentBadge({ order }: { order: Order }) {
  const method = (order.paymentMethod ?? "").toUpperCase();
  const meta = PAYMENT_META[method];
  const Icon = meta?.icon ?? CreditCard;
  const paid = (order.paymentStatus ?? "PENDING").toUpperCase() === "PAID";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${paid ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {meta?.label ?? method ?? "—"}
      <span className="font-normal opacity-80">· {paid ? "öndə" : "gözləyir"}</span>
    </span>
  );
}

function OrderStatus({ order, onSave, pending }: { order: Order; onSave: (id: string, status: string) => void; pending: boolean }) {
  const [status, setStatus] = useState(order.status || "");
  useEffect(() => setStatus(order.status || ""), [order.id, order.status]);
  const changed = status.trim().toUpperCase() !== (order.status || "").toUpperCase();
  return <div className="flex min-w-56 items-center gap-2"><Input value={status} onChange={(event) => setStatus(event.target.value.toUpperCase())} aria-label={`${order.orderNumber ?? order.id} sifarişinin statusu`} className="h-9 uppercase" maxLength={50} /><Button type="button" size="icon" variant="outline" className="h-9 w-9" disabled={!changed || !status.trim() || pending} onClick={() => onSave(order.id, status.trim())} aria-label="Statusu saxla">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}</Button></div>;
}

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const client = useQueryClient();
  const params = { page, limit: LIMIT, ...(search ? { search } : {}), ...(status ? { status } : {}) };
  const query = useQuery({ queryKey: queryKeys.orders(params), queryFn: () => ordersApi.list(params), placeholderData: keepPreviousData });
  const mutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => ordersApi.updateStatus(id, status), onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "orders"] }) });
  const markPaid = useMutation({ mutationFn: (id: string) => ordersApi.markPaid(id), onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "orders"] }) });

  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); setStatus(status.trim().toUpperCase()); };

  return <div>
    <PageHeader title="Sifarişlər" description="Sifarişləri axtarın, statusu dəyişin və nağd ödənişləri təsdiqləyin" />
    <Card><CardContent className="p-5"><form onSubmit={submitSearch} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]" role="search"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="pl-9" placeholder="Sifariş və ya istifadəçi" aria-label="Sifariş axtarışı" /></div><Input value={status} onChange={(event) => setStatus(event.target.value.toUpperCase())} placeholder="Status" aria-label="Status filtri" /><Button type="submit" variant="outline">Filtr et</Button></form></CardContent></Card>
    <div className="mt-4 space-y-4">
      {mutation.isError ? <Alert variant="error">{toApiError(mutation.error).message}</Alert> : null}
      {markPaid.isError ? <Alert variant="error">{toApiError(markPaid.error).message}</Alert> : null}
      {query.isPending ? <LoadingState label="Sifarişlər yüklənir…" /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.isSuccess ? <Card className="overflow-hidden"><CardContent className="p-0">
        {query.data.data.length === 0 ? <div className="p-5"><EmptyState title="Sifariş tapılmadı" description="Axtarış və status filtrini dəyişin." /></div> : <><Table><TableHeader><TableRow><TableHead>Sifariş</TableHead><TableHead>Müştəri</TableHead><TableHead>Qiymət</TableHead><TableHead>Ödəniş</TableHead><TableHead>Tarix</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{query.data.data.map((order) => {
          const awaitingPayment = (order.status ?? "").toUpperCase() === "PENDING" && (order.paymentStatus ?? "PENDING").toUpperCase() !== "PAID";
          return <TableRow key={order.id}>
            <TableCell><p className="font-mono text-xs font-semibold">{order.orderNumber ?? order.id}</p>{order.customerPhone ? <p className="text-xs text-muted-foreground">{order.customerPhone}</p> : null}</TableCell>
            <TableCell><p>{order.user?.fullName || order.user?.email || "—"}</p>{order.user?.email && order.user?.fullName ? <p className="text-xs text-muted-foreground">{order.user.email}</p> : null}</TableCell>
            <TableCell>{toCurrency(order.total, order.currency)}{order.itemCount != null ? <p className="text-xs text-muted-foreground">{order.itemCount} element</p> : null}</TableCell>
            <TableCell><PaymentBadge order={order} /></TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">{toDateLabel(order.createdAt)}</TableCell>
            <TableCell>
              <div className="flex min-w-56 items-center gap-2">
                <OrderStatus order={order} pending={mutation.isPending} onSave={(id, next) => mutation.mutate({ id, status: next })} />
                {awaitingPayment ? (
                  <Button type="button" size="sm" className="h-9 shrink-0" disabled={markPaid.isPending} onClick={() => markPaid.mutate(order.id)}>
                    {markPaid.isPending && markPaid.variables === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" aria-hidden />}
                    Ödəniş alındı
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>;
        })}</TableBody></Table><div className="p-5 pt-4"><Pagination meta={query.data.meta} onPageChange={setPage} /></div></>}
      </CardContent></Card> : null}
    </div>
  </div>;
}