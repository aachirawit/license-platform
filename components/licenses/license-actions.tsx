"use client";

import { useState } from "react";
import {
  Ban,
  CalendarPlus,
  MoreHorizontal,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { LicenseStatus, ProviderLicense } from "@/lib/license/types";

export interface LicensePermissions {
  ban: boolean;
  extend: boolean;
  resetHwid: boolean;
}

type Dialog = "ban" | "unban" | "revoke" | "reset" | "extend" | null;

export function LicenseActions({
  license,
  perms,
  onChanged,
}: {
  license: Pick<ProviderLicense, "id" | "keyPrefix" | "status" | "hwidBound">;
  perms: LicensePermissions;
  onChanged: (updated: ProviderLicense) => void;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(30);

  const status: LicenseStatus = license.status;
  const canBan = perms.ban && (status === "ACTIVE" || status === "UNUSED" || status === "EXPIRED");
  const canUnban = perms.ban && status === "BANNED";
  const canRevoke = perms.ban && status !== "REVOKED";

  async function run(path: string, body?: unknown, success?: string) {
    setBusy(true);
    try {
      const { license: updated } = await apiFetch<{ license: ProviderLicense }>(path, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      toast.success(success ?? "Done");
      onChanged(updated);
      setDialog(null);
      setReason("");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const anyAction = canBan || canUnban || canRevoke || perms.extend || perms.resetHwid;
  if (!anyAction) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {perms.resetHwid && (
            <DropdownMenuItem onClick={() => setDialog("reset")} disabled={!license.hwidBound}>
              <RotateCcw className="h-4 w-4" />
              Reset HWID{!license.hwidBound && " (not bound)"}
            </DropdownMenuItem>
          )}
          {perms.extend && (
            <DropdownMenuItem onClick={() => setDialog("extend")}>
              <CalendarPlus className="h-4 w-4" />
              Extend
            </DropdownMenuItem>
          )}
          {canUnban && (
            <DropdownMenuItem onClick={() => setDialog("unban")}>
              <ShieldCheck className="h-4 w-4" />
              Unban
            </DropdownMenuItem>
          )}
          {(canBan || canRevoke) && <DropdownMenuSeparator />}
          {canBan && (
            <DropdownMenuItem variant="danger" onClick={() => setDialog("ban")}>
              <Ban className="h-4 w-4" />
              Ban
            </DropdownMenuItem>
          )}
          {canRevoke && (
            <DropdownMenuItem variant="danger" onClick={() => setDialog("revoke")}>
              <Trash2 className="h-4 w-4" />
              Revoke
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reset HWID */}
      <AlertDialog open={dialog === "reset"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset HWID</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the current machine binding for {license.keyPrefix}-••••. The next device
              to use the key will bind to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => run(`/api/licenses/${license.id}/reset-hwid`, undefined, "HWID reset")}
            >
              Reset HWID
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unban */}
      <AlertDialog open={dialog === "unban"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unban license</AlertDialogTitle>
            <AlertDialogDescription>
              Restore {license.keyPrefix}-•••• to active use.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => run(`/api/licenses/${license.id}/unban`, undefined, "License unbanned")}
            >
              Unban
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ban (with reason) */}
      <AlertDialog open={dialog === "ban"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban license</AlertDialogTitle>
            <AlertDialogDescription>
              This prevents {license.keyPrefix}-•••• from being used. It can be unbanned later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ban-reason">Reason (optional)</Label>
            <Input id="ban-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Chargeback" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => run(`/api/licenses/${license.id}/ban`, { reason: reason || undefined }, "License banned")}
            >
              Ban license
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke (permanent) */}
      <AlertDialog open={dialog === "revoke"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke license</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently kills {license.keyPrefix}-••••. Unlike a ban, it cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="revoke-reason">Reason (optional)</Label>
            <Input id="revoke-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => run(`/api/licenses/${license.id}/revoke`, { reason: reason || undefined }, "License revoked")}
            >
              Revoke permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Extend */}
      <AlertDialog open={dialog === "extend"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Extend license</AlertDialogTitle>
            <AlertDialogDescription>
              Add days to {license.keyPrefix}-••••. Extending a lapsed key starts the new window from
              today.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="extend-days">Days to add</Label>
            <Input
              id="extend-days"
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || days < 1}
              onClick={() => run(`/api/licenses/${license.id}/extend`, { days }, `Extended by ${days} days`)}
            >
              Extend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
