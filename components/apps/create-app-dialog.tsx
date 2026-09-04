"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { createAppSchema, type CreateAppInput } from "@/lib/validation/app";

// Turns "SZK Optimizer" into a URL slug for the slug field's default.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function CreateAppDialog({ openByDefault = false }: { openByDefault?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(openByDefault);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateAppInput>({
    resolver: zodResolver(createAppSchema),
    defaultValues: { provider: "MOCK" },
  });

  // Deep-link support: the app switcher's "Add application" pushes ?new=1.
  useEffect(() => {
    if (openByDefault) setOpen(true);
  }, [openByDefault]);

  async function onSubmit(values: CreateAppInput) {
    setSubmitting(true);
    try {
      await apiFetch("/api/apps", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success(`Created ${values.name}`);
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create application");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          New Application
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New application</DialogTitle>
          <DialogDescription>
            Each application has its own licenses, packages and key prefix.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="SZK Optimizer"
              {...register("name", {
                onChange: (e) => {
                  // Prefill slug + appId from the name for convenience.
                  const v = e.target.value as string;
                  setValue("slug", slugify(v));
                  setValue(
                    "appId",
                    v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12),
                  );
                },
              })}
            />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" placeholder="szk-optimizer" {...register("slug")} />
              {errors.slug && <p className="text-xs text-danger">{errors.slug.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appId">App ID</Label>
              <Input id="appId" placeholder="SZK" className="font-mono" {...register("appId")} />
              {errors.appId && <p className="text-xs text-danger">{errors.appId.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="keyPrefix">Key prefix (optional)</Label>
            <Input
              id="keyPrefix"
              placeholder="SZKP — derived from App ID if blank"
              className="font-mono"
              {...register("keyPrefix")}
            />
            {errors.keyPrefix && (
              <p className="text-xs text-danger">{errors.keyPrefix.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Input id="description" placeholder="Windows performance optimizer" {...register("description")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create application
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
