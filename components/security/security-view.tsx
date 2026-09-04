"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime, maskedKey } from "@/lib/format";
import { maskIp } from "@/lib/mask";
import type { SecurityEventDto } from "@/lib/services/security-service";

interface Res {
  events: SecurityEventDto[];
  total: number;
  pageCount: number;
}

const SEVERITY_VARIANT: Record<string, "danger" | "warning" | "muted"> = {
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "muted",
};

const TYPES = [
  "ALL",
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "MULTIPLE_LOGIN_FAILURES",
  "HWID_MISMATCH",
  "INVALID_LICENSE",
  "LICENSE_BANNED_ATTEMPT",
  "HWID_RESET",
  "SUSPICIOUS_ACTIVITY",
];

export function SecurityView() {
  const [severity, setSeverity] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [days, setDays] = useState("30");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Res | null>(null);

  useEffect(() => {
    setData(null);
    const p = new URLSearchParams();
    if (severity !== "ALL") p.set("severity", severity);
    if (type !== "ALL") p.set("type", type);
    p.set("days", days);
    p.set("page", String(page));
    apiFetch<Res>(`/api/security/events?${p.toString()}`)
      .then(setData)
      .catch(() => setData({ events: [], total: 0, pageCount: 1 }));
  }, [severity, type, days, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={severity} onValueChange={(v) => { setPage(1); setSeverity(v); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["ALL", "HIGH", "MEDIUM", "LOW"].map((s) => (
              <SelectItem key={s} value={s}>{s === "ALL" ? "All severities" : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => { setPage(1); setType(v); }}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t === "ALL" ? "All event types" : t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={days} onValueChange={(v) => { setPage(1); setDays(v); }}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {([["7","7 days"],["30","30 days"],["90","90 days"],["180","180 days"]] as const).map(([v,l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>App</TableHead>
              <TableHead>License</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
              ))
            ) : data.events.length > 0 ? (
              data.events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell><Badge variant={SEVERITY_VARIANT[e.severity]}>{e.severity}</Badge></TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{e.type}</div>
                    <div className="text-xs text-muted-foreground">{e.message}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.appName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {e.licensePrefix ? maskedKey(e.licensePrefix) : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{maskIp(e.ip)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(e.createdAt)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-0">
                  <EmptyState icon={Shield} title="No security events" description="Nothing matched these filters." className="border-0" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">{data.total} events · page {page} of {data.pageCount}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= data.pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
