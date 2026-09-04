"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { createPackageSchema, type CreatePackageInput } from "@/lib/validation/package";
import type { PackageDto } from "@/lib/services/package-service";

function durationLabel(days: number): string {
  if (days === 0) return "Lifetime";
  if (days % 365 === 0) return `${days / 365} year${days > 365 ? "s" : ""}`;
  return `${days} days`;
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

export function ManagePackagesDialog({
  appSlug,
  appName,
  open,
  onOpenChange,
  canWrite,
}: {
  appSlug: string;
  appName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
}) {
  const [packages, setPackages] = useState<PackageDto[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreatePackageInput>({
    resolver: zodResolver(createPackageSchema),
    defaultValues: { durationDays: 30, priceCents: 0 },
  });

  useEffect(() => {
    if (!open) return;
    setPackages(null);
    apiFetch<{ packages: PackageDto[] }>(`/api/apps/${appSlug}/packages`)
      .then((d) => setPackages(d.packages))
      .catch(() => {
        toast.error("Failed to load packages");
        setPackages([]);
      });
  }, [open, appSlug]);

  async function onCreate(values: CreatePackageInput) {
    setSubmitting(true);
    try {
      const { package: pkg } = await apiFetch<{ package: PackageDto }>(
        `/api/apps/${appSlug}/packages`,
        { method: "POST", body: JSON.stringify(values) },
      );
      setPackages((prev) => [...(prev ?? []), pkg].sort((a, b) => a.durationDays - b.durationDays));
      reset({ durationDays: 30, priceCents: 0, name: "", slug: "" });
      toast.success(`Added ${pkg.name}`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to add package");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(pkg: PackageDto) {
    try {
      await apiFetch(`/api/packages/${pkg.id}`, { method: "DELETE" });
      setPackages((prev) => (prev ?? []).filter((p) => p.id !== pkg.id));
      toast.success(`Removed ${pkg.name}`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to remove package");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Packages — {appName}</DialogTitle>
          <DialogDescription>
            Packages set the default duration for generated keys. Removing one keeps issued keys.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {packages === null ? (
            <>
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </>
          ) : packages.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No packages yet.
            </p>
          ) : (
            packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium">{pkg.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {durationLabel(pkg.durationDays)} · {pkg.licenseCount ?? 0} licenses
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={pkg.status === "ACTIVE" ? "success" : "muted"}>
                    {pkg.status}
                  </Badge>
                  {canWrite && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-danger"
                      onClick={() => onDelete(pkg)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {canWrite && (
          <form
            onSubmit={handleSubmit(onCreate)}
            className="space-y-3 rounded-md border border-border p-3"
          >
            <div className="text-xs font-medium text-muted-foreground">Add a package</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pkg-name">Name</Label>
                <Input
                  id="pkg-name"
                  placeholder="Premium 30 Days"
                  {...register("name", {
                    onChange: (e) => setValue("slug", slugify(e.target.value as string)),
                  })}
                />
                {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pkg-days">Duration (days, 0 = lifetime)</Label>
                <Input id="pkg-days" type="number" min={0} {...register("durationDays")} />
                {errors.durationDays && (
                  <p className="text-xs text-danger">{errors.durationDays.message}</p>
                )}
              </div>
            </div>
            <input type="hidden" {...register("slug")} />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add package
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
