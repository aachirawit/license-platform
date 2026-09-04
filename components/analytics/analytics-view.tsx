"use client";

import { useEffect, useState } from "react";
import { Ban, CircleSlash, Clock, KeyRound, RotateCcw, ShieldCheck } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityChart, StatusChart } from "@/components/dashboard/charts";
import { apiFetch } from "@/lib/api-client";
import type {
  DayPoint,
  OverviewCounts,
  StatusSlice,
} from "@/lib/services/analytics-service";

interface AnalyticsData {
  overview: OverviewCounts;
  distribution: StatusSlice[];
  series: DayPoint[];
}

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
];

export function AnalyticsView({ appSlug }: { appSlug: string }) {
  const [days, setDays] = useState("30");
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    setData(null);
    apiFetch<AnalyticsData>(`/api/analytics?appId=${appSlug}&days=${days}`)
      .then(setData)
      .catch(() => setData(null));
  }, [appSlug, days]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Licenses" value={data.overview.licenses} icon={KeyRound} />
            <StatCard label="Active" value={data.overview.active} icon={ShieldCheck} accent="primary" />
            <StatCard label="Unused" value={data.overview.unused} icon={Clock} accent="muted" />
            <StatCard label="Expired" value={data.overview.expired} icon={CircleSlash} accent="warning" />
            <StatCard label="Banned" value={data.overview.banned} icon={Ban} accent="danger" />
            <StatCard label="Revoked" value={data.overview.revoked} icon={RotateCcw} accent="danger" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Generated vs. activated</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityChart data={data.series} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Status distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusChart data={data.distribution} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
