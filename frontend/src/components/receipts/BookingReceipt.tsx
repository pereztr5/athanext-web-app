import React from 'react';
import logo from '@/assets/athaLink-logo.png';
import { strings } from "@/config/strings";

interface BookingReceiptProps {
  data: {
    bookingId: string;
    issueDateLabel: string;
    sessionName: string;
    sessionDate: string;
    sessionDay: string;
    sessionTime: string;
    duration: string;
    type: string;
    location: string;
    coachName: string;
    coachTitle?: string;
    coachInitials: string;
    basePriceLabel: string;
    totalPaidLabel: string;
  };
}

export const BookingReceipt: React.FC<BookingReceiptProps> = ({ data }) => {
  return (
    <div className="bg-white text-gray-900 rounded-2xl border border-gray-200 shadow-md px-6 py-6 sm:px-10 sm:py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-gray-200">
        <div className="flex items-center" aria-label={strings.brand.name}>
          <span className="sr-only">{strings.brand.name}</span>
          <img src={logo} alt="" className="h-12 w-auto" />
        </div>
        <div className="text-right text-sm text-gray-600 leading-tight flex flex-col justify-center">
          <p className="text-lg font-bold uppercase tracking-tight text-gray-900">Receipt</p>
          {/* <p>Booking ID: {data.bookingId || '—'}</p> */}
          <p>Date Issued: {data.issueDateLabel || '—'}</p>
        </div>
      </div>

      {/* Session Information */}
      <div className="py-5 border-b border-gray-200 space-y-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Session Information</div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-gray-900">{data.sessionName || 'Training Session'}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
          <div className="space-y-1">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Date</p>
            <p className="font-semibold text-gray-900">{data.sessionDate || '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Day</p>
            <p className="font-semibold text-gray-900">{data.sessionDay || '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Time</p>
            <p className="font-semibold text-gray-900">{data.sessionTime || '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Duration</p>
            <p className="font-semibold text-gray-900">{data.duration || '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Type</p>
            <p className="font-semibold text-gray-900">{data.type || '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Location</p>
            <p className="font-semibold text-gray-900">{data.location || '—'}</p>
          </div>
        </div>
      </div>

      {/* Coach */} 
      <div className="py-5 border-b border-gray-200"> 
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Coach</div> 
        <div className="flex items-center gap-3"> 
          <div className="flex flex-col justify-center leading-tight">
            <p className="font-semibold text-gray-900">{data.coachName || 'Your Coach'}</p> 
            {data.coachTitle && <p className="text-sm text-gray-600">{data.coachTitle}</p>} 
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="py-5 space-y-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Summary</div>
        <div className="border border-blue-300 rounded-xl p-4 sm:p-5 space-y-3 shadow-[0_8px_24px_rgba(37,99,235,0.05)]">
          <div className="flex items-center justify-between text-sm text-gray-800">
            <span>Base Session Price</span>
            <span className="font-semibold text-gray-900">{data.basePriceLabel}</span>
          </div>
          <div className="pt-3 border-t border-blue-200 flex items-center justify-between text-base">
            <span className="font-semibold text-gray-900">Total Paid</span>
            <span className="font-bold text-blue-700">{data.totalPaidLabel}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 text-center text-xs text-gray-600 space-y-1 leading-relaxed">
        <p className="font-semibold text-gray-800">Thank you for booking with {strings.brand.name}!</p>
        <p>Questions about your booking? Contact us at support@athanext.com</p>
        <p className="text-gray-500">This is an official receipt for your training session booking.</p>
      </div>
    </div>
  );
};

export default BookingReceipt;
