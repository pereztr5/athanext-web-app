import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { NewFamilyBooking } from "@/api/schedule";
import { scheduleSettingsAPI } from "@/api/scheduleSettings";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { plural } from "@/utils/schedule";
import { dialogContent, input, label, primaryButton, secondaryButton } from "../styles";
import type { RulesView } from "./BookingRulesCard";
import { caption } from "./shared";
import { useFail } from "./useFail";

interface Form {
  cancel: string;
  window: string;
  miles: string;
  zip: string;
  groupMin: string;
  newFamilies: NewFamilyBooking;
}

const toForm = (r: RulesView): Form => ({
  cancel: String(r.cancelNoticeHours ?? 24),
  window: String(r.bookingWindowWeeks),
  miles: r.travelMiles ? String(r.travelMiles) : "",
  zip: r.travelZip ?? r.homeZip ?? "",
  groupMin: r.groupMin ? String(r.groupMin) : "",
  newFamilies: r.newFamilyBooking,
});

/** Prototype options, plus the saved value when it's something else. */
const withCurrent = (values: number[], current: number | null) =>
  current && !values.includes(current) ? [...values, current].sort((a, b) => a - b) : values;

const Field = ({ text, hint, error, children }: { text: string; hint?: string; error?: string; children: ReactNode }) => (
  <label className="flex min-w-0 flex-col gap-1.5">
    <span className={label}>{text}</span>
    {children}
    {error ? <span className="text-[12px] leading-[14px] text-[#972B2B]">{error}</span> : hint ? <span className={caption}>{hint}</span> : null}
  </label>
);

/** Mounted only while open, so the form starts from the saved rules each time. */
export const EditRulesDialog = ({ rules, onClose }: { rules: RulesView; onClose: () => void }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fail = useFail();
  const [f, setF] = useState<Form>(() => toForm(rules));
  const [zipError, setZipError] = useState<string | undefined>();

  const set = (patch: Partial<Form>) => setF((prev) => ({ ...prev, ...patch }));

  const save = useMutation({
    mutationFn: () =>
      scheduleSettingsAPI.setRules({
        newFamilyBooking: f.newFamilies,
        bookingWindowWeeks: Number(f.window),
        cancelNoticeHours: Number(f.cancel),
        travelMiles: f.miles ? Number(f.miles) : null,
        travelZip: f.miles ? f.zip.trim() : null,
        groupMin: f.groupMin ? Number(f.groupMin) : null,
      }),
    onSuccess: () => {
      toast({ title: "Booking rules saved" });
      queryClient.invalidateQueries({ queryKey: ["schedule-settings"] });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      onClose();
    },
    onError: fail,
  });

  const submit = () => {
    if (f.miles && !/^\d{5}$/.test(f.zip.trim())) {
      setZipError("Use a 5-digit ZIP code");
      return;
    }
    save.mutate();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(dialogContent, "w-[calc(100vw-16px)] max-w-[640px] md:w-[calc(100vw-32px)]")}>
        <DialogHeader className="border-b border-[#EAEADF] px-4 py-5 pr-14 text-left md:px-[25px]">
          <DialogTitle className="text-[20px] font-semibold leading-[24px] tracking-[-0.05em] md:text-[24px] md:leading-[30px]">Booking rules</DialogTitle>
          <DialogDescription className="sr-only">Cancellation, booking window, travel, group minimum and new families</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-4 py-5 md:px-[25px]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field text="Free cancellation notice">
              <select className={input} value={f.cancel} onChange={(e) => set({ cancel: e.target.value })}>
                {withCurrent([12, 24, 48], rules.cancelNoticeHours).map((h) => (
                  <option key={h} value={h}>
                    {plural(h, "hour")}
                  </option>
                ))}
              </select>
            </Field>
            <Field text="Booking window">
              <select className={input} value={f.window} onChange={(e) => set({ window: e.target.value })}>
                {withCurrent([2, 4, 8], rules.bookingWindowWeeks).map((w) => (
                  <option key={w} value={w}>
                    {plural(w, "week")} ahead
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field text="Travel" error={zipError}>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,140px)] gap-2">
              <select className={input} value={f.miles} onChange={(e) => set({ miles: e.target.value })} aria-label="How far you travel">
                <option value="">Not set</option>
                {withCurrent([5, 10, 15, 20, 25, 30, 50], rules.travelMiles).map((m) => (
                  <option key={m} value={m}>
                    Within {plural(m, "mile")}
                  </option>
                ))}
              </select>
              <input
                className={input}
                inputMode="numeric"
                maxLength={5}
                placeholder="ZIP code"
                aria-label="ZIP code you travel from"
                disabled={!f.miles}
                value={f.zip}
                onChange={(e) => {
                  set({ zip: e.target.value.replace(/\D/g, "") });
                  setZipError(undefined);
                }}
              />
            </div>
          </Field>
          <Field text="Group minimum">
            <select className={input} value={f.groupMin} onChange={(e) => set({ groupMin: e.target.value })}>
              <option value="">No minimum</option>
              {withCurrent([2, 3, 4], rules.groupMin).map((n) => (
                <option key={n} value={n}>
                  {n} athletes
                </option>
              ))}
            </select>
          </Field>
          <Field
            text="Families new to you"
            hint="Your own athletes always book instantly. Requests are held for 24 hours and nothing is charged until you accept."
          >
            <select className={input} value={f.newFamilies} onChange={(e) => set({ newFamilies: e.target.value as NewFamilyBooking })}>
              <option value="request">Request first (you approve each booking)</option>
              <option value="instant">Instant booking</option>
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap justify-end gap-2.5 border-t border-[#EAEADF] px-4 py-4 md:px-[25px]">
          <button type="button" className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={save.isPending} onClick={submit}>
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
