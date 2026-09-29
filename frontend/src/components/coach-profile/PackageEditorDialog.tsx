import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { packagesAPI } from "@/api/packages";
import type { CoachPackage } from "@/hooks/useCoachPackages";

interface PackageEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachId: string;
  /** When set, dialog updates this package; otherwise creates a new one. */
  packageToEdit?: CoachPackage | null;
}

const MIN_PACKAGE_TOTAL_CENTS = 50;

function centsToDollarsInput(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return "";
  return (cents / 100).toFixed(2);
}

function dollarsToCents(value: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

function parseFeatures(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((f) => f.trim())
    .filter(Boolean);
}

export function PackageEditorDialog({
  open,
  onOpenChange,
  coachId,
  packageToEdit = null,
}: PackageEditorDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(packageToEdit?.id);

  const [packageName, setPackageName] = useState("");
  const [description, setDescription] = useState("");
  const [sessionCount, setSessionCount] = useState("4");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [pricePerSessionDollars, setPricePerSessionDollars] = useState("");
  const [totalPriceDollars, setTotalPriceDollars] = useState("");
  const [totalPriceTouched, setTotalPriceTouched] = useState(false);
  const [validityDays, setValidityDays] = useState("90");
  const [featuresRaw, setFeaturesRaw] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (packageToEdit) {
      setPackageName(packageToEdit.package_name ?? "");
      setDescription(packageToEdit.description ?? "");
      setSessionCount(String(packageToEdit.session_count ?? 4));
      setDurationMinutes(String(packageToEdit.duration_minutes ?? 60));
      setPricePerSessionDollars(centsToDollarsInput(packageToEdit.price_per_session));
      setTotalPriceDollars(centsToDollarsInput(packageToEdit.total_price));
      setTotalPriceTouched(true);
      setValidityDays(String(packageToEdit.validity_days ?? 90));
      setFeaturesRaw((packageToEdit.features ?? []).join(", "));
      setIsActive(packageToEdit.is_active ?? true);
    } else {
      setPackageName("");
      setDescription("");
      setSessionCount("4");
      setDurationMinutes("60");
      setPricePerSessionDollars("");
      setTotalPriceDollars("");
      setTotalPriceTouched(false);
      setValidityDays("90");
      setFeaturesRaw("");
      setIsActive(true);
    }
  }, [open, packageToEdit]);

  const computedTotalCents = useMemo(() => {
    const sessions = Number.parseInt(sessionCount, 10) || 0;
    const perSession = dollarsToCents(pricePerSessionDollars);
    return sessions * perSession;
  }, [sessionCount, pricePerSessionDollars]);

  useEffect(() => {
    if (totalPriceTouched) return;
    setTotalPriceDollars(centsToDollarsInput(computedTotalCents));
  }, [computedTotalCents, totalPriceTouched]);

  const handleSave = async () => {
    const name = packageName.trim();
    if (!name) {
      toast({
        title: "Package name required",
        description: "Enter a name for this package.",
        variant: "destructive",
      });
      return;
    }

    const sessions = Number.parseInt(sessionCount, 10);
    const duration = Number.parseInt(durationMinutes, 10);
    const validity = Number.parseInt(validityDays, 10);
    const totalPrice = dollarsToCents(totalPriceDollars);

    if (!sessions || sessions < 1) {
      toast({
        title: "Invalid session count",
        description: "Session count must be at least 1.",
        variant: "destructive",
      });
      return;
    }
    if (!duration || duration < 1) {
      toast({
        title: "Invalid duration",
        description: "Duration must be at least 1 minute.",
        variant: "destructive",
      });
      return;
    }
    if (!validity || validity < 1) {
      toast({
        title: "Invalid validity",
        description: "Validity must be at least 1 day.",
        variant: "destructive",
      });
      return;
    }
    // Stripe checkout rejects charges under $0.50.
    if (totalPrice < MIN_PACKAGE_TOTAL_CENTS) {
      toast({
        title: "Invalid price",
        description: "Total price must be at least $0.50.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const features = parseFeatures(featuresRaw);
      const payload = {
        package_name: name,
        description: description.trim() || null,
        session_count: sessions,
        duration_minutes: duration,
        total_price: totalPrice,
        validity_days: validity,
        features,
        is_active: isActive,
      };

      const response = isEdit && packageToEdit
        ? await packagesAPI.updateCoachPackage(packageToEdit.id, payload)
        : await packagesAPI.createCoachPackage({
            ...payload,
            coach_id: coachId,
          });

      if (response.error) {
        toast({
          title: isEdit ? "Could not update package" : "Could not create package",
          description: response.error.message || "Please try again.",
          variant: "destructive",
        });
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["coach-packages", coachId] });
      toast({
        title: isEdit ? "Package updated" : "Package created",
        description: isEdit
          ? "Your coaching package was updated."
          : "Your coaching package was added.",
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg gap-0 overflow-hidden p-0 font-sans tracking-[-0.03em] text-[#1A202C] [&>button]:right-[17px] [&>button]:top-[19px]">
        <DialogHeader className="space-y-1.5 px-[25px] py-5 pr-14 text-left">
          <DialogTitle className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em] text-[#1A202C]">
            {isEdit ? "Edit package" : "Add package"}
          </DialogTitle>
          <DialogDescription className="text-[14px] leading-[18px] tracking-[-0.03em] text-[#767980]">
            {isEdit
              ? "Update this coaching package. Prices are entered in dollars and saved as cents."
              : "Create a coaching package athletes can purchase. Prices are entered in dollars and saved as cents."}
          </DialogDescription>
        </DialogHeader>

        <div className="h-px bg-[#EAEADF]" />

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-[25px] py-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pkg-name" className="text-[12px] font-medium text-[#767980]">
              Package name
            </Label>
            <Input
              id="pkg-name"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              placeholder="e.g. Starter 4-pack"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pkg-description" className="text-[12px] font-medium text-[#767980]">
              Description
            </Label>
            <Textarea
              id="pkg-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What athletes get with this package"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pkg-sessions" className="text-[12px] font-medium text-[#767980]">
                Session count
              </Label>
              <Input
                id="pkg-sessions"
                type="number"
                min={1}
                value={sessionCount}
                onChange={(e) => setSessionCount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pkg-duration" className="text-[12px] font-medium text-[#767980]">
                Duration (minutes)
              </Label>
              <Input
                id="pkg-duration"
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pkg-pps" className="text-[12px] font-medium text-[#767980]">
                Price per session ($)
              </Label>
              <Input
                id="pkg-pps"
                type="number"
                min={0}
                step="0.01"
                value={pricePerSessionDollars}
                onChange={(e) => {
                  setPricePerSessionDollars(e.target.value);
                  if (!totalPriceTouched) {
                    /* computed effect updates total */
                  }
                }}
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pkg-total" className="text-[12px] font-medium text-[#767980]">
                Total price ($)
              </Label>
              <Input
                id="pkg-total"
                type="number"
                min={0}
                step="0.01"
                value={totalPriceDollars}
                onChange={(e) => {
                  setTotalPriceTouched(true);
                  setTotalPriceDollars(e.target.value);
                }}
                placeholder="0.00"
              />
              {!totalPriceTouched && computedTotalCents > 0 ? (
                <p className="text-[12px] text-[#767980]">
                  Auto: sessions × per-session
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pkg-validity" className="text-[12px] font-medium text-[#767980]">
              Validity (days)
            </Label>
            <Input
              id="pkg-validity"
              type="number"
              min={1}
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pkg-features" className="text-[12px] font-medium text-[#767980]">
              Features (comma-separated)
            </Label>
            <Textarea
              id="pkg-features"
              value={featuresRaw}
              onChange={(e) => setFeaturesRaw(e.target.value)}
              placeholder="Video review, Chat support, Progress plan"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] px-4 py-3">
            <div>
              <p className="text-[14px] font-medium text-[#1A202C]">Active</p>
              <p className="text-[12px] text-[#767980]">
                Inactive packages are hidden from athletes.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <div className="h-px bg-[#EAEADF]" />

        <DialogFooter className="px-[25px] py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
