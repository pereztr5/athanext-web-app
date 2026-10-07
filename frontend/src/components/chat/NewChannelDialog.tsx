/** Messages "New channel" (Working Copy): a coach starts another group chat families can join from their profile. */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { chatAPI } from "@/api/chat";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dialogContent, input, label, meta, primaryButton, secondaryButton } from "@/components/schedule/styles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export const NewChannelDialog = ({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [about, setAbout] = useState("");
  const close = () => {
    setTitle("");
    setAbout("");
    onClose();
  };
  const create = useMutation({
    mutationFn: () => chatAPI.createCoachChannel(title.trim(), about.trim()),
    onSuccess: (id) => {
      toast({ title: `#${title.trim()} created`, description: "Families can join it from your profile." });
      onCreated(id);
      close();
    },
    onError: (e: Error) => toast({ title: "Couldn't create the channel", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle className="text-[22px] font-semibold leading-[28px] tracking-[-0.05em]">New channel</DialogTitle>
          <DialogDescription className={meta}>A group chat for a team or group. Families join it from your profile.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 pb-5 sm:px-[25px]">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Name</span>
            <input className={input} maxLength={60} placeholder="For example, U14 group" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>What it's for (optional)</span>
            <input className={cn(input)} maxLength={140} placeholder="Saturday group sessions and updates" value={about} onChange={(e) => setAbout(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButton} onClick={close}>Cancel</button>
            <button type="button" className={primaryButton} disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Creating…" : "Create channel"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
