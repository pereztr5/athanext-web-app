/**
 * Coach intro call settings (Working Copy "Offer a free intro call"): on or off, length, video
 * or phone, meeting link, only new families, weekly limit and up to 2 questions.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "@/components/icons";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { introCallsAPI, type IntroSettings } from "@/api/introCalls";
import { dialogContent, iconButton, input, label, primaryButton, secondaryButton, segButton, segGroup, textButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { plural } from "@/utils/schedule";
import { INTRO_KEYS, capText, errorText, mText } from "./helpers";
import { SheetHeader } from "./parts";

const DEFAULTS: IntroSettings = {
  enabled: true,
  minutes: 15,
  format: "video",
  newOnly: true,
  weeklyLimit: 3,
  questions: ["Athlete's age and team", "What would you like to work on?"],
  videoUrl: null,
};

const Seg = <T extends string | number>({ value, options, onChange, ariaLabel }: { value: T; options: [T, string][]; onChange: (v: T) => void; ariaLabel: string }) => (
  <div className={cn(segGroup, "w-full sm:w-auto")} role="group" aria-label={ariaLabel}>
    {options.map(([v, text]) => (
      <button key={String(v)} type="button" className={cn(segButton(value === v), "h-[30px]")} aria-pressed={value === v} onClick={() => onChange(v)}>
        {text}
      </button>
    ))}
  </div>
);

const Line = ({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
    <span className="flex flex-col gap-1">
      <span className={mText}>{title}</span>
      {detail ? <span className={capText}>{detail}</span> : null}
    </span>
    {children}
  </div>
);

export const IntroSettingsDialog = ({ open, turnOn = false, onClose }: { open: boolean; turnOn?: boolean; onClose: () => void }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: INTRO_KEYS.settings, queryFn: () => introCallsAPI.mySettings(), enabled: open });
  const [form, setForm] = useState<IntroSettings>(DEFAULTS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !settingsQuery.data) return;
    const { bookedThisWeek: _count, ...saved } = settingsQuery.data;
    setForm({ ...saved, enabled: saved.enabled || turnOn });
    setError(null);
  }, [open, turnOn, settingsQuery.data]);

  const set = <K extends keyof IntroSettings>(key: K, value: IntroSettings[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setQuestion = (i: number, text: string) => setForm((f) => ({ ...f, questions: f.questions.map((q, j) => (j === i ? text : q)) }));

  const save = useMutation({
    mutationFn: () => introCallsAPI.saveSettings({ ...form, videoUrl: form.videoUrl?.trim() || null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INTRO_KEYS.settings });
      void queryClient.invalidateQueries({ queryKey: ["coach-intro"] });
      void queryClient.invalidateQueries({ queryKey: INTRO_KEYS.enabled });
      void queryClient.invalidateQueries({ queryKey: INTRO_KEYS.home });
      toast({ title: form.enabled ? "Free intro call is on" : "Free intro call is off" });
      onClose();
    },
    onError: (err) => setError(errorText(err, "Couldn't save your intro call.")),
  });

  const limits: [number, string][] = [2, 3, 5].includes(form.weeklyLimit)
    ? [[2, "2 a week"], [3, "3 a week"], [5, "5 a week"]]
    : ([...new Set([2, 3, 5, form.weeklyLimit])].sort((a, b) => a - b).map((n) => [n, `${n} a week`]) as [number, string][]);
  const booked = settingsQuery.data?.bookedThisWeek ?? 0;
  const urlInvalid = Boolean(form.videoUrl?.trim()) && !/^https:\/\//i.test(form.videoUrl!.trim());

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={dialogContent}>
        <SheetHeader title="Free intro call" description="Families can meet you before they book. Shows on your profile and in search." />
        <div className="flex flex-col gap-[14px] px-5 pb-5 sm:px-[25px]">
          {settingsQuery.isLoading ? (
            <p className={capText}>Loading…</p>
          ) : settingsQuery.isError ? (
            <p role="alert" className="text-body-m text-error-700">Couldn't load your intro call settings.</p>
          ) : (
            <>
              <Line title="Offer a free intro call" detail="Families can meet you before they book">
                <Switch checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} aria-label="Offer a free intro call" />
              </Line>
              {form.enabled ? (
                <div className="flex flex-col gap-[14px] border-t border-light-525 pt-[18px]">
                  <Line title="Length">
                    <Seg ariaLabel="Length" value={form.minutes} onChange={(v) => set("minutes", v)} options={[[10, "10 min"], [15, "15 min"], [20, "20 min"]]} />
                  </Line>
                  <Line title="How">
                    <Seg ariaLabel="How" value={form.format} onChange={(v) => set("format", v)} options={[["video", "Video call"], ["phone", "Phone call"]]} />
                  </Line>
                  {form.format === "video" ? (
                    <label className="flex flex-col gap-1.5">
                      <span className={label}>Meeting link</span>
                      <input
                        className={input}
                        type="url"
                        inputMode="url"
                        value={form.videoUrl ?? ""}
                        onChange={(e) => set("videoUrl", e.target.value)}
                        placeholder="https://meet.google.com/abc-defg-hij"
                        maxLength={500}
                        aria-invalid={urlInvalid}
                      />
                      <span className={capText}>{urlInvalid ? "Use a link that starts with https://" : "Your Zoom, Google Meet or Teams room. Join opens it for you and the family."}</span>
                    </label>
                  ) : (
                    <p className={capText}>You call the family at the time. Their number shows on Home.</p>
                  )}
                  <Line title="Only new families" detail="Families who already booked with you won't see it">
                    <Switch checked={form.newOnly} onCheckedChange={(v) => set("newOnly", v)} aria-label="Only new families" />
                  </Line>
                  <Line title="Weekly limit" detail={`${plural(booked, "call")} booked this week`}>
                    <Seg ariaLabel="Weekly limit" value={form.weeklyLimit} onChange={(v) => set("weeklyLimit", v)} options={limits} />
                  </Line>
                  <div className="flex flex-col gap-2">
                    <span className="flex flex-col gap-1">
                      <span className={mText}>Questions families answer</span>
                      <span className={capText}>Up to 2, so you can prepare</span>
                    </span>
                    {form.questions.map((q, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input className={input} value={q} maxLength={200} aria-label={`Question ${i + 1}`} onChange={(e) => setQuestion(i, e.target.value)} />
                        <button
                          type="button"
                          className={iconButton}
                          aria-label="Remove question"
                          onClick={() => set("questions", form.questions.filter((_, j) => j !== i))}
                        >
                          <X strokeWidth={1.5} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    {form.questions.length < 2 ? (
                      <button type="button" className={cn(textButton, "self-start")} onClick={() => set("questions", [...form.questions, ""])}>
                        <Plus strokeWidth={1.5} aria-hidden="true" />
                        Add a question
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          )}
          {error ? (
            <p role="alert" className="text-body-m text-error-700">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButton} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={primaryButton}
              disabled={save.isPending || !settingsQuery.data || (form.enabled && form.format === "video" && urlInvalid)}
              onClick={() => save.mutate()}
            >
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
