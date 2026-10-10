import { useState } from "react";
import { Clock } from "lucide-react";
import type { BookingRulesInput } from "@/api/scheduleSettings";
import { cn } from "@/lib/utils";
import { plural } from "@/utils/schedule";
import { card, secondaryButton, smallButton } from "../styles";
import { EditRulesDialog } from "./EditRulesDialog";
import { CardHeading, caption } from "./shared";

export interface RulesView extends BookingRulesInput {
  cancellationPolicy: string | null;
  homeZip: string | null;
}

const cancellationText = (r: Pick<RulesView, "cancelNoticeHours" | "cancellationPolicy">) =>
  r.cancelNoticeHours
    ? `${plural(r.cancelNoticeHours, "hour")} notice for a full refund`
    : r.cancellationPolicy || "24 hours notice for a full refund";

export const BookingRulesCard = ({ rules, loading }: { rules: RulesView; loading: boolean }) => {
  const [editing, setEditing] = useState(false);

  const rows: [string, string][] = [
    ["Cancellation", cancellationText(rules)],
    ["Booking window", `Up to ${plural(rules.bookingWindowWeeks, "week")} ahead`],
    ["Travel", rules.travelMiles && rules.travelZip ? `Within ${plural(rules.travelMiles, "mile")} of ${rules.travelZip}` : "Not set"],
    ["Group minimum", rules.groupMin ? `${rules.groupMin} athletes, or the session moves` : "No minimum"],
    ["New families", rules.newFamilyBooking === "instant" ? "Instant booking" : "Request first, you approve within 24 hours"],
  ];

  return (
    <section className={card}>
      <CardHeading icon={Clock} title="Booking rules" />
      <div className="flex flex-col gap-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-3">
            <span className={cn(caption, "flex-none pt-0.5")}>{k}</span>
            {loading ? (
              <span className="h-[18px] w-40 animate-pulse rounded-[4px] bg-[#F1F1E6]" />
            ) : (
              <span className="min-w-0 text-right">{v}</span>
            )}
          </div>
        ))}
      </div>
      <button type="button" className={cn(secondaryButton, smallButton, "self-start")} disabled={loading} onClick={() => setEditing(true)}>
        Edit rules
      </button>
      {editing ? <EditRulesDialog rules={rules} onClose={() => setEditing(false)} /> : null}
    </section>
  );
};
