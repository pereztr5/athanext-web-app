import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "@/components/icons";
import { calendarSyncAPI, type CalendarConnection } from "@/api/schedule";
import { BrandPill } from "@/components/brand";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { card, textButton } from "../styles";
import { CardHeading, Switch, caption } from "./shared";
import { useFail } from "./useFail";

/** On = connected. Turning it on starts Google sign-in; off disconnects. */
export const CalendarSyncCard = ({ calendar, loading }: { calendar: CalendarConnection | null; loading: boolean }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fail = useFail();

  const connect = useMutation({
    mutationFn: () => calendarSyncAPI.connectUrl(),
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: fail,
  });
  const disconnect = useMutation({
    mutationFn: () => calendarSyncAPI.disconnect(),
    onSuccess: () => {
      toast({ title: "Google Calendar disconnected" });
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
    },
    onError: fail,
  });

  const on = Boolean(calendar);
  const needsReconnect = calendar && (calendar.syncError === "reconnect" || !calendar.canWrite);

  return (
    <section className={card}>
      <CardHeading icon={RefreshCw} title="Calendar sync" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 text-label-sm text-dark">
            Google Calendar
            {needsReconnect ? <BrandPill tone="amber">Connect again</BrandPill> : null}
          </span>
          <span className={caption}>{loading ? " " : calendar ? calendar.accountEmail || "Connected" : "Not connected"}</span>
        </div>
        <Switch
          on={on}
          label="Google Calendar sync"
          disabled={loading || connect.isPending || disconnect.isPending}
          onChange={(next) => (next ? connect.mutate() : disconnect.mutate())}
        />
      </div>
      {needsReconnect ? (
        <p className="-mt-2 text-paragraph-sm text-info-800">
          {calendar.syncError === "reconnect"
            ? "Google stopped the connection."
            : "Connect again so your AthaNext sessions are added to your calendar."}{" "}
          <button type="button" className={cn(textButton, "text-label-xsm")} disabled={connect.isPending} onClick={() => connect.mutate()}>
            Connect again
          </button>
        </p>
      ) : calendar?.syncError ? (
        <p className="-mt-2 text-paragraph-sm text-error-700">Last update failed: {calendar.syncError}</p>
      ) : null}
      <p className={caption}>
        Busy times in your Google Calendar hide any open slots they overlap, so families can't book them. Your AthaNext sessions are added to your
        calendar.
      </p>
    </section>
  );
};
