import React from 'react';
import logo from '@/assets/AthaNext-Logo.svg';
import { strings } from "@/config/strings";
import { BrandPill } from "@/components/brand";

interface BookingReceiptProps {
  data: {
    /** Short booking reference ("#1A2B3C4D"); empty when there is no booking ID. */
    bookingRef: string;
    issueDateLabel: string;
    sessionName: string;
    coachName: string;
    type: string;
    /** "Monday, Mar 9, 2026" */
    dateLabel: string;
    /** "4:00 to 5:00 PM, 60 min" */
    timeLabel: string;
    /** "In person" / "Online" */
    locationLabel: string;
    /** Slot base price. */
    sessionPriceLabel: string;
    /** Everything added on top of the base price (platform + processing fees). */
    feeLabel: string;
    /** Fee-inclusive total. */
    totalPaidLabel: string;
    isPaid: boolean;
    supportEmail?: string;
  };
}

const labelClass = "text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#767980]";
const valueClass = "text-[14px] leading-[18px] tracking-[-0.03em]";

export const BookingReceipt: React.FC<BookingReceiptProps> = ({ data }) => {
  const title = data.coachName ? `${data.sessionName} with ${data.coachName}` : data.sessionName;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px] font-sans tracking-[-0.03em] text-[#1A202C]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <img src={logo} alt={strings.brand.name} className="h-7 w-auto" />
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[20px] font-medium leading-[18px] tracking-[-0.05em]">Receipt</span>
          <span className="text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
            Issued {data.issueDateLabel}
            {data.bookingRef ? ` · ${data.bookingRef}` : ''}
          </span>
        </div>
      </div>

      <div className="h-px bg-[#EAEADF]" />

      {/* Session */}
      <div className="flex flex-col gap-3.5">
        <span className="text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#A3A6AB]">Session</span>
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-medium leading-[18px] tracking-[-0.05em]">{title}</span>
          <BrandPill tone="blue">{data.type}</BrandPill>
        </div>
        <div className="grid grid-cols-3 gap-x-6 gap-y-3.5">
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Date</span>
            <span className={valueClass}>{data.dateLabel}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Time</span>
            <span className={valueClass}>{data.timeLabel}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Location</span>
            <span className={valueClass}>{data.locationLabel}</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-[#EAEADF]" />

      {/* Payment */}
      <div className="flex flex-col gap-3 rounded-[8px] bg-[#F4F4EB] px-5 py-4">
        <div className={`flex justify-between ${valueClass}`}>
          <span className="text-[#484D56]">Session</span>
          <span>{data.sessionPriceLabel}</span>
        </div>
        <div className={`flex justify-between ${valueClass}`}>
          <span className="text-[#484D56]">Platform fee</span>
          <span>{data.feeLabel}</span>
        </div>
        <div className="h-px bg-[#EAEADF]" />
        <div className="flex items-baseline justify-between">
          <span className="text-[16px] font-medium leading-[18px] tracking-[-0.05em]">Total paid</span>
          <span className="text-[28px] font-bold leading-[30px] tracking-[-0.05em]">{data.totalPaidLabel}</span>
        </div>
        {data.isPaid && (
          <div className="flex justify-end">
            <BrandPill tone="green">Paid</BrandPill>
          </div>
        )}
      </div>

      {/* Footer */}
      <span className="text-center text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]">
        Thanks for booking with {strings.brand.name}.
        {data.supportEmail ? ` Questions go to ${data.supportEmail}` : ''}
      </span>
    </div>
  );
};

export default BookingReceipt;
