/** "Add a coaching video" (Working Copy `AN.modals.video`): a YouTube or Vimeo link, saved right away. */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { coachProfileAPI } from "@/api/coachProfile";
import { useToast } from "@/hooks/use-toast";
import { dialogContent, input, label, primaryButton, secondaryButton, textButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { extrasKey } from "./hooks";

const VIDEO_LINK = /(youtube\.com|youtu\.be|vimeo\.com)\//i;

export const CoachingVideoDialog = ({
  open,
  onOpenChange,
  coachId,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachId: string;
  current: string | null;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl(current ?? "");
      setError("");
    }
  }, [open, current]);

  const save = async (next: string | null) => {
    if (next !== null && !VIDEO_LINK.test(next)) {
      setError("Paste a YouTube or Vimeo link");
      return;
    }
    setSaving(true);
    try {
      await coachProfileAPI.setCoachingVideo(next);
      await queryClient.invalidateQueries({ queryKey: extrasKey(coachId) });
      toast({ title: next ? "Coaching video added" : "Coaching video removed" });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Couldn't save the video", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="space-y-1.5 px-[25px] pb-4 pt-5 pr-14 text-left">
          <DialogTitle className="text-[24px] font-semibold leading-[30px] tracking-[-0.05em]">Add a coaching video</DialogTitle>
          <DialogDescription className="text-[14px] leading-[18px] text-[#767980]">
            A 30 to 90 second clip of you coaching works best.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4 px-[25px] pb-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save(url.trim() || null);
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className={label}>Video link</span>
            <input
              className={cn(input, error && "ring-2 ring-[#972B2B]")}
              placeholder="youtube.com/watch?v=… or vimeo.com/…"
              value={url}
              inputMode="url"
              aria-invalid={Boolean(error)}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
            />
            {error ? <span className="text-[12px] text-[#972B2B]">{error}</span> : null}
          </label>
          <div className="flex items-center justify-end gap-2">
            {current ? (
              <button type="button" className={cn(textButton, "mr-auto text-[#972B2B]")} disabled={saving} onClick={() => void save(null)}>
                Remove video
              </button>
            ) : null}
            <button type="button" className={secondaryButton} onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={primaryButton} disabled={saving || !url.trim()}>
              {saving ? "Saving…" : current ? "Save video" : "Add video"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
