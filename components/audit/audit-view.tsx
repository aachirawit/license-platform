"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { apiFetch } from "@/lib/api-client";
import { actionLabel } from "@/lib/activity-labels";
import { formatDateTime } from "@/lib/format";
import { maskIp } from "@/lib/mask";
import type { AuditLogDto } from "@/lib/services/audit-service";

interface Res {
  logs: AuditLogDto[];
  total: number;
  pageCount: number;
}

export function AuditView() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Res | null>(null);

  useEffect(() => {
    setData(null);
    apiFetch<Res>(`/api/audit-logs?page=${page}`)
      .then(setData)
      .catch(() => setData({ logs: [], total: 0, pageCount: 1 }));
  }, [page]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>App</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
              ))
            ) : data.logs.length > 0 ? (
              data.logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Badge variant="outline">{l.action}</Badge>
                    <span className="ml-2 text-xs text-muted-foreground">{actionLabel(l.action)}</span>
                  </TableCell>
                  <TableCell className="text-sm">{l.adminName ?? "System"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.appName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {l.targetType ? `${l.targetType}${l.targetId ? ` · ${l.targetId.slice(0, 8)}` : ""}` : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{maskIp(l.ip)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(l.createdAt)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-0">
                  <EmptyState icon={ScrollText} title="No audit logs" description="Admin actions will appear here." className="border-0" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">{data.total} entries · page {page} of {data.pageCount}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= data.pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
