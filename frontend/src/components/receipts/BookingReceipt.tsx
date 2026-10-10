import logo from "@/assets/AthaNext-Logo.svg";
import { BrandPill } from "@/components/brand";
import { strings } from "@/config/strings";
import { CalendarPlus, Mail } from "lucide-react";
import { secondaryButton, smallButton } from "@/components/schedule/styles";
import { cn } from "@/lib/utils";
import { formatMoney, type ReceiptModel } from "./receiptModel";

const labelClass = "text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#767980]";
const valueClass = "text-[14px] leading-[18px] tracking-[-0.03em]";

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
  <section className="mx-auto flex w-full max-w-[700px] flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[18px] pb-5 pt-[22px] font-sans tracking-[-0.03em] text-[#1A202C] md:px-[25px] md:pb-[25px] md:pt-[30px]">
    <div className="flex items-start justify-between gap-4">
      <img src={logo} alt={strings.brand.name} className="h-7 w-auto" />
      <div className="flex flex-col items-end gap-1.5 text-right">
        <span className="text-[20px] font-medium leading-[18px] tracking-[-0.05em]">{model.isReceipt ? "Receipt" : "Confirmation"}</span>
        <span className="text-[12px] leading-[14px] text-[#767980]">
          {model.issuedLabel ? `Issued ${model.issuedLabel}` : "Issued"}
          {model.number ? ` · #${model.number}` : ""}
        </span>
      </div>
    </div>

    <div className="h-px bg-[#EAEADF]" />

    {model.lines.map((line, i) => (
      <div key={line.id}>
        {i ? <div className="mb-5 h-px bg-[#EAEADF]" /> : null}
        <div className="flex flex-col gap-3.5">
          <span className="text-[12px] font-medium leading-[13px] text-[#A3A6AB]">Session</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-medium leading-[18px] tracking-[-0.05em]">{line.title}</span>
            {line.group ? <BrandPill tone="teal">Group</BrandPill> : <BrandPill tone="neutral">1-on-1</BrandPill>}
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

    <div className="flex flex-col gap-3 rounded-[8px] bg-[#F4F4EB] px-5 py-4">
      {model.isReceipt || model.sessions || model.credits ? (
        <>
          {model.direct.length && !model.sessions && !model.credits ? null : (
            <div className={`flex justify-between ${valueClass}`}>
              <span className="text-[#484D56]">Sessions</span>
              <span className="tabular-nums">{formatMoney(model.sessions)}</span>
            </div>
          )}
          {model.credits ? (
            <div className={`flex justify-between ${valueClass}`}>
              <span className="text-[#484D56]">Package credits used</span>
              <span className="tabular-nums">{model.credits}</span>
            </div>
          ) : null}
          {model.fees ? (
            <div className={`flex justify-between ${valueClass}`}>
              <span className="text-[#484D56]">Platform fee</span>
              <span className="tabular-nums">{formatMoney(model.fees)}</span>
            </div>
          ) : null}
          {model.isReceipt || model.credits ? (
            <>
              <div className="h-px bg-[#EAEADF]" />
              <div className="flex items-baseline justify-between">
                <span className="text-[16px] font-medium leading-[18px] tracking-[-0.05em]">Total paid</span>
                <span className="text-[28px] font-bold leading-[30px] tracking-[-0.05em] tabular-nums">{formatMoney(model.total)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] leading-[14px] text-[#767980]">
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
          {model.isReceipt || model.credits ? <div className="h-px bg-[#EAEADF]" /> : null}
          <div className="flex items-baseline justify-between">
            <span className="text-[16px] font-medium tracking-[-0.05em]">Pay {d.firstName} directly</span>
            <span className="text-[28px] font-bold leading-[30px] tracking-[-0.05em] tabular-nums">{formatMoney(d.amount)}</span>
          </div>
          <span className="text-[12px] leading-[14px] text-[#767980]">{d.note || "Not charged in AthaNext"}</span>
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

    <p className="text-center text-[12px] leading-[14px] text-[#767980]">
      Thanks for booking with {strings.brand.name}.
      {supportEmail ? ` Questions go to ${supportEmail}` : ""}
    </p>
  </section>
);

export default BookingReceipt;
