"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { durationLabel } from "@/lib/format";
import type { PackageDto } from "@/lib/services/package-service";

const DURATION_OPTIONS = [
  { value: "package", label: "Package default" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "365 days" },
  { value: "0", label: "Lifetime" },
];

export function GenerateDialog({
  appSlug,
  appName,
  packages,
}: {
  appSlug: string;
  appName: string;
  packages: PackageDto[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(10);
  const [packageId, setPackageId] = useState<string>(packages[0]?.id ?? "none");
  const [duration, setDuration] = useState<string>("package");
  const [customMode, setCustomMode] = useState(false);
  const [customKey, setCustomKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [keys, setKeys] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setSubmitting(true);
    try {
      const durationDays =
        duration === "package" ? undefined : Number(duration);
      const payload =
        customMode
          ? { customKey: customKey.trim(), packageId: packageId === "none" ? undefined : packageId, durationDays }
          : { quantity, packageId: packageId === "none" ? undefined : packageId, durationDays };
      const data = await apiFetch<{ keys: string[]; count: number }>(
        `/api/apps/${appSlug}/licenses/generate`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      setKeys(data.keys);
      toast.success(`${data.count} licenses generated`);
      router.refresh(); // refresh the underlying list counts
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Generation failed");
    } finally {
      setSubmitting(false);
    }
  }

  function copyAll() {
    if (!keys) return;
    void navigator.clipboard.writeText(keys.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function close() {
    setOpen(false);
    // Reset after the close animation so keys are not retrievable again.
    setTimeout(() => {
      setKeys(null);
      setQuantity(10);
      setDuration("package");
      setCustomMode(false);
      setCustomKey("");
    }, 200);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Generate Keys
        </Button>
      </DialogTrigger>
      <DialogContent>
        {keys === null ? (
          <>
            <DialogHeader>
              <DialogTitle>Generate license keys</DialogTitle>
              <DialogDescription>
                Copy the keys now, or copy any key later from its row in the list.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Application</Label>
                <Input value={appName} disabled />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Package</Label>
                  <Select value={packageId} onValueChange={setPackageId}>
                    <SelectTrigger>
                      <SelectValue placeholder="No package" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No package</SelectItem>
                      {packages.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {durationLabel(p.durationDays)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="qty">Quantity</Label>
                  <Input
                    id="qty"
                    type="number"
                    min={1}
                    max={500}
                    value={quantity}
                    disabled={customMode}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={customMode}
                  onChange={(e) => setCustomMode(e.target.checked)}
                />
                Use a custom key (creates exactly one)
              </label>

              {customMode && (
                <div className="space-y-1.5">
                  <Label htmlFor="ckey">Custom key</Label>
                  <Input
                    id="ckey"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value.toUpperCase())}
                    placeholder="VIP-2026-ALPHA"
                    className="font-mono"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground">
                    Letters, digits and dashes. Must be unique.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button
                onClick={generate}
                disabled={submitting || (customMode && customKey.trim().length < 3)}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {customMode ? "Create key" : "Generate keys"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                {keys.length} licenses generated
              </DialogTitle>
              <DialogDescription>
                Copy these now — they will not be shown again.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-background p-3 font-mono text-sm">
              {keys.map((k) => (
                <div key={k} className="py-0.5 tabular-nums">
                  {k}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={copyAll}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy all"}
              </Button>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
