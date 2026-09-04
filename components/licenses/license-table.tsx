"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { LicenseStatusBadge } from "./status-badge";
import { LicenseActions, type LicensePermissions } from "./license-actions";
import { apiFetch } from "@/lib/api-client";
import { formatDate, maskedKey, relativeTime } from "@/lib/format";
import type { LicenseStatus, ProviderLicense } from "@/lib/license/types";
import type { PackageDto } from "@/lib/services/package-service";

interface ListResponse {
  licenses: ProviderLicense[];
  total: number;
  page: number;
  pageCount: number;
}

const STATUS_OPTIONS: (LicenseStatus | "ALL")[] = [
  "ALL",
  "ACTIVE",
  "UNUSED",
  "EXPIRED",
  "BANNED",
  "REVOKED",
];

export function LicenseTable({
  appSlug,
  packages,
  perms,
}: {
  appSlug: string;
  packages: PackageDto[];
  perms: LicensePermissions;
}) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [packageId, setPackageId] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (packageId !== "ALL") params.set("packageId", packageId);
    if (search.trim()) params.set("search", search.trim());
    params.set("page", String(page));
    params.set("pageSize", "25");
    try {
      const res = await apiFetch<ListResponse>(
        `/api/apps/${appSlug}/licenses?${params.toString()}`,
      );
      setData(res);
    } catch {
      setData({ licenses: [], total: 0, page: 1, pageCount: 1 });
    } finally {
      setLoading(false);
    }
  }, [appSlug, status, packageId, search, page]);

  // Debounce search; other filters apply immediately.
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  function onRowChanged(updated: ProviderLicense) {
    setData((prev) =>
      prev
        ? { ...prev, licenses: prev.licenses.map((l) => (l.id === updated.id ? updated : l)) }
        : prev,
    );
  }

  const packageName = (id: string | null) =>
    id ? (packages.find((p) => p.id === id)?.name ?? "—") : "—";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search by key prefix (e.g. SZKP-7X2K)"
            className="pl-8"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(1);
            setStatus(v);
          }}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "ALL" ? "All statuses" : s.charAt(0) + s.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={packageId}
          onValueChange={(v) => {
            setPage(1);
            setPackageId(v);
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All packages</SelectItem>
            {packages.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>HWID</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !data ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : data && data.licenses.length > 0 ? (
              data.licenses.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Link
                      href={`/licenses/${l.id}`}
                      className="font-mono text-sm hover:text-primary hover:underline"
                    >
                      {maskedKey(l.keyPrefix)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {packageName(l.packageId)}
                  </TableCell>
                  <TableCell>
                    <LicenseStatusBadge status={l.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.hwidBound ? "Bound" : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(l.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.expiresAt ? formatDate(l.expiresAt) : "Lifetime"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {relativeTime(l.lastUsedAt)}
                  </TableCell>
                  <TableCell>
                    <LicenseActions license={l} perms={perms} onChanged={onRowChanged} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-0">
                  <EmptyState
                    icon={KeyRound}
                    title="No licenses found"
                    description="There are no licenses matching your filters."
                    className="border-0"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">
            {data.total} licenses · page {data.page} of {data.pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= data.pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
