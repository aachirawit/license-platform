"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { formatDate, relativeTime } from "@/lib/format";
import { createAdminSchema, type CreateAdminInput } from "@/lib/validation/admin";
import type { AdminDto } from "@/lib/services/admin-service";

const ROLES = ["SUPER_ADMIN", "ADMIN", "SUPPORT", "READ_ONLY"] as const;
const ROLE_VARIANT: Record<string, "success" | "default" | "muted"> = {
  SUPER_ADMIN: "success",
  ADMIN: "default",
  SUPPORT: "muted",
  READ_ONLY: "muted",
};

export function AdminsView({
  initialAdmins,
  currentAdminId,
  canWrite,
}: {
  initialAdmins: AdminDto[];
  currentAdminId: string;
  canWrite: boolean;
}) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateAdminInput>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: { role: "READ_ONLY" },
  });
  const roleValue = watch("role");

  async function onCreate(values: CreateAdminInput) {
    setSubmitting(true);
    try {
      const { admin } = await apiFetch<{ admin: AdminDto }>("/api/admins", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setAdmins((prev) => [...prev, admin]);
      toast.success(`Created ${admin.email}`);
      setOpen(false);
      reset({ role: "READ_ONLY" });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create admin");
    } finally {
      setSubmitting(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>, msg: string) {
    try {
      const { admin } = await apiFetch<{ admin: AdminDto }>(`/api/admins/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setAdmins((prev) => prev.map((a) => (a.id === admin.id ? admin : a)));
      toast.success(msg);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Update failed");
    }
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                New Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New admin</DialogTitle>
                <DialogDescription>
                  They can sign in immediately with the password you set.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" {...register("name")} />
                    {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Select value={roleValue} onValueChange={(v) => setValue("role", v as CreateAdminInput["role"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...register("email")} />
                  {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" {...register("password")} />
                  {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create admin
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admin</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((a) => {
              const isSelf = a.id === currentAdminId;
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {a.name}
                      {isSelf && <Badge variant="outline">You</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{a.email}</div>
                  </TableCell>
                  <TableCell>
                    {canWrite && !isSelf ? (
                      <Select value={a.role} onValueChange={(v) => patch(a.id, { role: v }, "Role updated")}>
                        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={ROLE_VARIANT[a.role]}>{a.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {a.disabled ? (
                      <Badge variant="danger">Disabled</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {relativeTime(a.lastLoginAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(a.createdAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {canWrite && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" />
          Changing a role or disabling an admin signs out their existing sessions immediately.
        </p>
      )}
    </div>
  );
}
