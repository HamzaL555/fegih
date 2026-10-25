"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/resource-states";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getList, updateUser } from "@/lib/api/admin";
import { toApiError } from "@/lib/api/error";
import { queryKeys } from "@/lib/query/keys";
import { getInitials, toDateLabel } from "@/lib/utils";
import type { AdminUser } from "@/types/admin";

const LIMIT = 20;

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "blocked" | "deleted">("active");
  const queryClient = useQueryClient();
  const params = { page, limit: LIMIT, status, ...(search ? { search } : {}) };

  const query = useQuery({
    queryKey: queryKeys.users(params),
    queryFn: () => getList<AdminUser>("/admin/users", params),
    placeholderData: keepPreviousData
  });

  const mutation = useMutation({
    mutationFn: ({ id, isBlocked }: { id: string; isBlocked: boolean }) => updateUser(id, { isBlocked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
  });

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const toggleBlock = (user: AdminUser) => {
    const userStatus = user.status?.toUpperCase();
    const currentlyBlocked = Boolean(user.isBlocked) || userStatus === "BLOCKED" || userStatus === "SUSPENDED";
    const next = !currentlyBlocked;
    if (next && !window.confirm(`${user.fullName || user.name || user.email} hesabını bloklayırsınız?`)) return;
    mutation.mutate({ id: user.id, isBlocked: next });
  };

  return (
    <div>
      <PageHeader title="İstifadəçilər" description="İstifadəçi hesablarını axtarın və bloklama vəziyyətini idarə edin" />
      <Card>
        <CardContent className="p-5">
          <form onSubmit={submitSearch} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]" role="search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="pl-9" placeholder="Ad, istifadəçi adı və ya e-poçt" aria-label="İstifadəçi axtarışı" />
            </div>
            <Select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as typeof status); }} aria-label="İstifadəçi statusu">
              <option value="active">Aktivlər</option>
              <option value="blocked">Bloklananlar</option>
              <option value="deleted">Silinmişlər</option>
            </Select>
            <Button type="submit" variant="outline">Axtar</Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-4 space-y-4">
        {mutation.isError ? <Alert variant="error">{toApiError(mutation.error).message}</Alert> : null}
        {query.isPending ? <LoadingState label="İstifadəçilər yüklənir…" /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
        {query.isSuccess ? (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {query.data.data.length === 0 ? (
                <div className="p-5"><EmptyState title="İstifadəçi tapılmadı" description="Axtarış meyarlarını dəyişin və ya API-də hələ istifadəçi yoxdur." /></div>
              ) : (
                <>
                  <Table>
                    <TableHeader><TableRow><TableHead>İstifadəçi</TableHead><TableHead>Rol</TableHead><TableHead>Status</TableHead><TableHead>Xal</TableHead><TableHead>Qeyd</TableHead><TableHead className="text-right">Əməliyyat</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {query.data.data.map((user) => {
                        const userStatus = user.status?.toUpperCase();
                        const blocked = Boolean(user.isBlocked) || userStatus === "BLOCKED" || userStatus === "SUSPENDED";
                        const deleted = Boolean(user.deletedAt) || userStatus === "DELETED";
                        const name = user.fullName || user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || user.username || "Adsız istifadəçi";
                        const contact = user.email || user.username || "—";
                        const avatar = user.avatarUrl || user.profileImage;
                        const roleName = typeof user.role === "string" ? user.role : user.role?.name || user.role?.code;
                        return (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex min-w-52 items-center gap-3">
                                {avatar ? <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{getInitials(name)}</span>}
                                <div><p className="font-medium">{name}</p><p className="text-xs text-muted-foreground">{contact}</p></div>
                              </div>
                            </TableCell>
                            <TableCell>{roleName || "—"}</TableCell>
                            <TableCell><Badge variant={deleted ? "secondary" : blocked ? "destructive" : "success"}>{deleted ? "Silinmiş" : blocked ? "Bloklanıb" : "Aktiv"}</Badge></TableCell>
                            <TableCell>{user.points ?? "—"}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{toDateLabel(user.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              <Button type="button" size="sm" variant={blocked ? "outline" : "destructive"} disabled={mutation.isPending || deleted} onClick={() => toggleBlock(user)}>
                                {blocked ? <CheckCircle2 className="mr-1.5 h-4 w-4" /> : <Ban className="mr-1.5 h-4 w-4" />}
                                {blocked ? "Bloku aç" : "Blokla"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="p-5 pt-4"><Pagination meta={query.data.meta} onPageChange={setPage} /></div>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
