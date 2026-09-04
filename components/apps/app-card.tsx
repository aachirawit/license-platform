"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, KeyRound, MoreVertical, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ManagePackagesDialog } from "./manage-packages-dialog";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { AppDto } from "@/lib/services/app-service";

export function AppCard({
  app,
  canWrite,
  canDelete,
}: {
  app: AppDto;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [packagesOpen, setPackagesOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    setDeleting(true);
    try {
      const data = await apiFetch<{ removedLicenses: number }>(`/api/apps/${app.id}`, {
        method: "DELETE",
      });
      toast.success(`Deleted ${app.name} (${data.removedLicenses} licenses removed)`);
      setConfirmDelete(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete application");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">{app.name}</div>
            <div className="font-mono text-xs text-muted-foreground">{app.appId}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={app.status === "ACTIVE" ? "success" : "muted"}>{app.status}</Badge>
          {(canWrite || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setPackagesOpen(true)}>
                  <Package className="h-4 w-4" />
                  Manage packages
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="danger" onClick={() => setConfirmDelete(true)}>
                      <Trash2 className="h-4 w-4" />
                      Delete application
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {app.description && (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{app.description}</p>
      )}

      <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" />
          <span className="tabular-nums font-medium text-foreground">{app.licenseCount ?? 0}</span>
          licenses
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="tabular-nums font-medium text-foreground">
            {app.activeLicenseCount ?? 0}
          </span>
          active
        </span>
        <span className="ml-auto font-mono">{app.keyPrefix}-••••</span>
      </div>

      <ManagePackagesDialog
        appSlug={app.slug}
        appName={app.name}
        open={packagesOpen}
        onOpenChange={setPackagesOpen}
        canWrite={canWrite}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {app.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the application and all {app.licenseCount ?? 0} of its
              licenses and packages. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={onDelete}>
              {deleting ? "Deleting…" : "Delete application"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
