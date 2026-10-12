/**
 * Locations card on Schedule settings (Working Copy 4). Removing a place does not
 * move sessions already booked there. Confirm first when it has upcoming sessions.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { coachesAPI } from "@/api";
import type { ScheduleSession } from "@/api/schedule";
import ConfirmationDialog from "@/components/common/ConfirmationDialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { plural } from "@/utils/schedule";
import { card, input, primaryButton, secondaryButton, smallButton } from "../styles";
import { CardHeading, caption } from "./shared";
import { useFail } from "./useFail";

export const LocationsCard = ({
  coachId,
  locations,
  sessions,
  today,
  loading,
}: {
  coachId: string;
  locations: string[];
  sessions: ScheduleSession[];
  today: string;
  loading: boolean;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fail = useFail();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const places = locations.filter((l) => l && l !== "Video call");

  const upcomingAt = (place: string) =>
    sessions.filter(
      (s) => s.date >= today && s.location === "in-person" && (s.place === place || (!s.place && place === places[0])),
    ).length;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
    void queryClient.invalidateQueries({ queryKey: ["schedule-settings"] });
  };

  const save = useMutation({
    mutationFn: async (next: string[]) => {
      const { error } = await coachesAPI.updateCoach(coachId, { locations: next });
      if (error) throw new Error(error.message || "Couldn't save locations");
    },
    onSuccess: () => {
      refresh();
    },
    onError: fail,
  });

  const add = () => {
    const n = name.trim();
    if (!n) {
      toast({ title: "Name the location" });
      return;
    }
    if (places.includes(n) || n === "Video call") {
      toast({ title: "You already have that location" });
      return;
    }
    void save.mutateAsync([...places, n]).then(() => {
      toast({ title: `${n} added` });
      setName("");
      setAdding(false);
    });
  };

  const rename = (from: string) => {
    const n = editName.trim();
    if (!n || n === from) {
      setEditing(null);
      return;
    }
    void save.mutateAsync(places.map((p) => (p === from ? n : p))).then(() => {
      toast({ title: "Location updated" });
      setEditing(null);
    });
  };

  const remove = (place: string) => {
    const upcoming = upcomingAt(place);
    void save.mutateAsync(places.filter((p) => p !== place)).then(() => {
      setConfirmRemove(null);
      toast({
        title: `${place} removed`,
        description: upcoming
          ? `${plural(upcoming, "upcoming session")} already there ${upcoming === 1 ? "stays" : "stay"} as ${upcoming === 1 ? "it is" : "they are"}.`
          : undefined,
      });
    });
  };

  const requestRemove = (place: string) => {
    if (upcomingAt(place) > 0) {
      setConfirmRemove(place);
      return;
    }
    remove(place);
  };

  const confirmCount = confirmRemove ? upcomingAt(confirmRemove) : 0;

  return (
    <section className={card}>
      <CardHeading icon={MapPin} title="Locations" />
      <p className={cn(caption, "-mt-2.5")}>
        Places families can book. Removing one does not move sessions already booked there.
      </p>
      {loading ? (
        <div className="h-[34px] animate-pulse rounded-[8px] bg-[#F1F1E6]" />
      ) : (
        <div className="flex flex-col gap-3">
          {places.length === 0 ? <p className="text-[14px] text-[#767980]">No in-person locations yet.</p> : null}
          {places.map((place) => {
            const n = upcomingAt(place);
            const isEdit = editing === place;
            return (
              <div key={place} className="flex flex-col gap-2 rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] px-3 py-3">
                {isEdit ? (
                  <div className="flex flex-col gap-2">
                    <input className={input} value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Location name" />
                    <div className="flex gap-2">
                      <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                      <button type="button" className={cn(primaryButton, smallButton)} disabled={save.isPending} onClick={() => rename(place)}>
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[14px] font-medium text-[#1A202C]">{place}</span>
                      <span className={caption}>{n ? `${plural(n, "upcoming session")}` : "No upcoming sessions"}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="inline-flex size-[30px] items-center justify-center rounded-[8px] text-[#767980] hover:bg-[#EAEADF]"
                        aria-label={`Edit ${place}`}
                        onClick={() => {
                          setEditing(place);
                          setEditName(place);
                        }}
                      >
                        <Pencil className="size-4" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        className="inline-flex size-[30px] items-center justify-center rounded-[8px] text-[#767980] hover:bg-[#FDF1F1] hover:text-[#B42318]"
                        aria-label={`Remove ${place}`}
                        disabled={save.isPending}
                        onClick={() => requestRemove(place)}
                      >
                        <Trash2 className="size-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-2 text-[13px] text-[#767980]">
            <MapPin className="size-3.5" strokeWidth={1.5} />
            Video call is always available
          </div>
          {adding ? (
            <div className="flex flex-col gap-2 rounded-[10px] border border-dashed border-[#C1C1B8] p-3">
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="For example, Mueller Park, field 3" />
              <div className="flex gap-2">
                <button type="button" className={cn(secondaryButton, smallButton)} onClick={() => setAdding(false)}>
                  Cancel
                </button>
                <button type="button" className={cn(primaryButton, smallButton)} disabled={save.isPending} onClick={add}>
                  Add location
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={cn(secondaryButton, smallButton, "self-start")} onClick={() => setAdding(true)}>
              <Plus className="size-3.5" strokeWidth={1.5} />
              Add location
            </button>
          )}
        </div>
      )}

      <ConfirmationDialog
        open={Boolean(confirmRemove)}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        title={confirmRemove ? `Remove ${confirmRemove}?` : "Remove location?"}
        description={
          confirmRemove
            ? `${confirmRemove} has ${plural(confirmCount, "upcoming session")}. They'll stay there. It just won't show when you create new sessions.`
            : undefined
        }
        cancelLabel="Keep it"
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmRemove) remove(confirmRemove);
        }}
      />
    </section>
  );
};
