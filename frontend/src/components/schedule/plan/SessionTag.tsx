/**
 * Age group or level on a planned group session (Working Copy 4 groupweek.js `.gw-chip`).
 * One tag per session, required before the week is sent.
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "@/components/icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scheduleAPI, type ScheduleSession } from "@/api/schedule";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { dialogContent, input, label, primaryButton } from "../styles";

export const SESSION_TAGS = [
  "U8",
  "U10",
  "U12",
  "U14",
  "U16",
  "U18",
  "U13 to U15",
  "All ages",
  "Beginners",
  "Youth development",
  "Advanced",
] as const;

export const sessionTagOf = (details?: { tag?: string; ages?: string } | null) =>
  (details?.tag || details?.ages || "").trim();

const chip = (on: boolean) =>
  cn(
    "inline-flex h-8 items-center gap-1.5 rounded-control border px-3 text-label-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    on ? "border-primary bg-primary-50 text-primary" : "border-light-525 bg-light-300 text-dark hover:bg-light-200",
  );

export const SessionTagField = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (tag: string) => void;
}) => {
  const preset = (SESSION_TAGS as readonly string[]).includes(value);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tag">
        {SESSION_TAGS.map((tag) => {
          const on = value === tag;
          return (
            <button key={tag} type="button" className={chip(on)} aria-pressed={on} onClick={() => onChange(on ? "" : tag)}>
              {on ? <Check className="size-3.5" strokeWidth={1.5} aria-hidden="true" /> : null}
              {tag}
            </button>
          );
        })}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Or type your own</span>
        <input
          className={input}
          value={preset ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="For example, Goalkeepers"
          maxLength={40}
          autoComplete="off"
        />
      </label>
    </div>
  );
};

/** Saves the tag onto the draft. Closes only after the write succeeds. */
export const SessionTagDialog = ({
  session,
  onClose,
}: {
  session: ScheduleSession | null;
  onClose: () => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tag, setTag] = useState("");
  useEffect(() => {
    setTag(session ? sessionTagOf(session.details) : "");
  }, [session]);

  const save = useMutation({
    mutationFn: () =>
      scheduleAPI.updateDraft(session!.id, {
        details: { ...session!.details, tag: tag.trim(), ages: tag.trim() },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      onClose();
    },
    onError: (err: unknown) =>
      toast({
        title: "That didn't save. Try again",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      }),
  });

  return (
    <Dialog open={Boolean(session)} onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-section">Tag</DialogTitle>
          <DialogDescription className="text-body-m text-dark-300">
            Age group or level. Families see it on the session.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
          <SessionTagField value={tag} onChange={setTag} />
          <button type="button" className={primaryButton} disabled={!tag.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save tag"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
