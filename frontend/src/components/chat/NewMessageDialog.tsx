/** Athlete "New message": pick one of your coaches and open (or start) that chat. */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { athleteHomeAPI } from "@/api/athleteHome";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dialogContent, meta, secondaryButton, textButton } from "@/components/schedule/styles";
import { useStartCoachChat } from "@/hooks/useStartCoachChat";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes";

export const NewMessageDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const home = useQuery({ queryKey: ["athlete-home"], queryFn: () => athleteHomeAPI.get(), enabled: open });
  const { start, starting } = useStartCoachChat();
  const coaches = home.data?.coaches ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={dialogContent}>
        <DialogHeader className="px-5 pb-3 pt-5 pr-14 text-left sm:px-[25px]">
          <DialogTitle>New message</DialogTitle>
          <DialogDescription className={meta}>Message a coach you already book with.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 px-5 pb-5 sm:px-[25px]">
          {home.isLoading ? <p className={meta}>Loading coaches…</p> : null}
          {!home.isLoading && !coaches.length ? (
            <div className="flex flex-col gap-3">
              <p className={meta}>
                Book a session first to message from here. You can also message a coach from their profile before booking.
              </p>
              <Link to={ROUTES.COACHES} className={cn(textButton, "self-start")} onClick={onClose}>
                Browse coaches
              </Link>
            </div>
          ) : null}
          {coaches.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={starting}
              onClick={() => {
                void start(c.id, c.name).then(onClose);
              }}
              className="flex items-center gap-3 rounded-control px-2 py-2 text-left hover:bg-light-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-dark-200"
            >
              <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary-300 bg-primary-50 text-label-xsm text-primary">
                {c.photo ? <img src={c.photo} alt="" className="size-full object-cover" /> : c.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <span className="min-w-0 flex-1 truncate text-label-sm">{c.name}</span>
            </button>
          ))}
          <button type="button" className={cn(secondaryButton, "mt-2 self-end")} onClick={onClose}>
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
