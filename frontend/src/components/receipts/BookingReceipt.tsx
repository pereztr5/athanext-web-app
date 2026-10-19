import logo from "@/assets/AthaNext-Logo.svg";
import { BrandPill } from "@/components/brand";
import { strings } from "@/config/strings";
import { CalendarPlus, Mail } from "@/components/icons";
import { secondaryButton, smallButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { formatMoney, type ReceiptModel } from "./receiptModel";

const labelClass = "text-label-xsm text-dark-300";
const valueClass = "text-body-m";

const BookingReceipt = ({
  model,
  supportEmail,
  onAddToCalendar,
  onEmail,
}: {
  model: ReceiptModel;
  supportEmail?: string;
  onAddToCalendar?: () => void;
  onEmail?: () => void;
}) => (
  <section className="flex w-full max-w-[700px] flex-col gap-5 rounded-card border border-light-525 bg-light-300 px-[18px] pb-5 pt-[22px] font-sans text-dark md:px-[25px] md:pb-[25px] md:pt-[30px]">
    <div className="flex items-start justify-between gap-4">
      <img src={logo} alt={strings.brand.name} className="h-7 w-auto" />
      <div className="flex flex-col items-end gap-1.5 text-right">
        <span className="text-card-title">{model.isReceipt ? "Receipt" : "Confirmation"}</span>
        <span className="text-caption text-dark-300">
          {model.issuedLabel ? `Issued ${model.issuedLabel}` : "Issued"}
          {model.number ? ` · #${model.number}` : ""}
        </span>
      </div>
    </div>

    <div className="h-px bg-light-525" />

    {model.lines.map((line, i) => (
      <div key={line.id}>
        {i ? <div className="mb-5 h-px bg-light-525" /> : null}
        <div className="flex flex-col gap-3.5">
          <span className="text-label-xsm text-dark-300">Session</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-subtitle">{line.title}</span>
            {line.group ? <BrandPill tone="teal">Group</BrandPill> : <BrandPill tone="blue">1-on-1</BrandPill>}
            {line.request ? <BrandPill tone="amber">Request sent, not charged</BrandPill> : null}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>Date</span>
              <span className={valueClass}>{line.dateLabel}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>Time</span>
              <span className={valueClass}>{line.timeLabel}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>Location</span>
              <span className={valueClass}>{line.locationLabel}</span>
            </div>
          </div>
        </div>
      </div>
    ))}

    <div className="flex flex-col gap-3 rounded-control bg-light-400 px-5 py-4">
      {model.isReceipt || model.sessions || model.credits ? (
        <>
          {model.direct.length && !model.sessions && !model.credits ? null : (
            <div className={`flex justify-between ${valueClass}`}>
              <span className="text-dark-300">Sessions</span>
              <span className="tabular-nums">{formatMoney(model.sessions)}</span>
            </div>
          )}
          {model.credits ? (
            <div className={`flex justify-between ${valueClass}`}>
              <span className="text-dark-300">Package credits used</span>
              <span className="tabular-nums">{model.credits}</span>
            </div>
          ) : null}
          {model.fees ? (
            <div className={`flex justify-between ${valueClass}`}>
              <span className="text-dark-300">Platform fee</span>
              <span className="tabular-nums">{formatMoney(model.fees)}</span>
            </div>
          ) : null}
          {model.isReceipt || model.credits ? (
            <>
              <div className="h-px bg-light-525" />
              <div className="flex items-baseline justify-between">
                <span className="text-subtitle">Total paid</span>
                <span className="text-highlight tabular-nums">{formatMoney(model.total)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-caption text-dark-300">
                  {model.total ? "Card, through Stripe" : "Covered by package credits"}
                </span>
                <BrandPill tone="green">{model.pending ? "Payment pending" : "Paid"}</BrandPill>
              </div>
            </>
          ) : null}
        </>
      ) : null}
      {model.direct.map((d) => (
        <div key={d.coachId} className="flex flex-col gap-1.5">
          {model.isReceipt || model.credits ? <div className="h-px bg-light-525" /> : null}
          <div className="flex items-baseline justify-between">
            <span className="text-subtitle">Pay {d.firstName} directly</span>
            <span className="text-highlight tabular-nums">{formatMoney(d.amount)}</span>
          </div>
          <span className="text-caption text-dark-300">{d.note || "Not charged in AthaNext"}</span>
        </div>
      ))}
    </div>

    {onAddToCalendar || onEmail ? (
      <div className="flex flex-wrap gap-2">
        {onAddToCalendar ? (
          <button type="button" className={cn(secondaryButton, smallButton)} onClick={onAddToCalendar}>
            <CalendarPlus strokeWidth={1.5} aria-hidden="true" />
            Add to calendar
          </button>
        ) : null}
        {onEmail ? (
          <button type="button" className={cn(secondaryButton, smallButton)} onClick={onEmail}>
            <Mail strokeWidth={1.5} aria-hidden="true" />
            Email {model.isReceipt ? "receipt" : "confirmation"}
          </button>
        ) : null}
      </div>
    ) : null}

    <p className="text-center text-caption text-dark-300">
      Thanks for booking with {strings.brand.name}.
      {supportEmail ? ` Questions go to ${supportEmail}` : ""}
    </p>
  </section>
);

export default BookingReceipt;
