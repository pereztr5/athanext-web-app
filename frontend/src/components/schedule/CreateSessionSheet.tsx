/**
 * Opens the Create session sheet in place (My schedule, Home, and the top bar).
 * The week page at /schedule/create stays as its own route. Camp in the type picker
 * closes the sheet and opens the camp editor.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CampEditorDialog } from "@/components/camps/CampEditorDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scheduleAPI } from "@/api/schedule";
import { useAuth } from "@/contexts/AuthContext";
import { useViewerTimeZone } from "@/hooks/useViewerTimeZone";
import { addDaysISO } from "@/utils/schedule";
import { isoDateInZone } from "@/utils/viewerTime";
import { cn } from "@/lib/utils";
import { dialogContent } from "./styles";
import { phoneSheet, sheetBody, sheetHeader, sheetTitle } from "./create/classes";
import { CreateSessionDialog } from "./CreateSessionDialog";

export const CreateSessionSheet = ({
  open,
  onOpenChange,
  startDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Day to start on. Today when omitted. */
  startDate?: string;
}) => {
  const { userProfile, userName } = useAuth();
  const coachId = userProfile?.coach_id ?? null;
  const timeZone = useViewerTimeZone();
  const todayISO = isoDateInZone(new Date(), timeZone);
  const start = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && startDate >= todayISO ? startDate : todayISO;

  const schedule = useQuery({
    queryKey: ["coach-schedule", "create-sheet", todayISO],
    enabled: open && Boolean(coachId),
    queryFn: () => scheduleAPI.get(addDaysISO(todayISO, -1), addDaysISO(todayISO, 8)),
  });

  const [campOpen, setCampOpen] = useState(false);
  const camp = coachId ? <CampEditorDialog open={campOpen} campId={null} onOpenChange={setCampOpen} /> : null;
  const pickCamp = () => {
    setCampOpen(true);
    onOpenChange(false);
  };

  if (!open || !coachId) return camp;

  if (!schedule.data?.rules) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className={cn(dialogContent, phoneSheet)}>
          <DialogHeader className={sheetHeader}>
            <DialogTitle className={sheetTitle}>Create session</DialogTitle>
            <DialogDescription className="sr-only">Loading the form.</DialogDescription>
          </DialogHeader>
          <div className={sheetBody}>
            <p className="text-body-m text-dark-300">
              {schedule.isError ? "Couldn't load your schedule. Try again." : "Loading…"}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <CreateSessionDialog
        open
        onOpenChange={onOpenChange}
        startDate={start}
        todayISO={todayISO}
        timeZone={timeZone}
        rules={schedule.data.rules}
        coachId={coachId}
        coachName={userName || userProfile?.name || "Your coach"}
        onPickCamp={pickCamp}
      />
      {camp}
    </>
  );
};
