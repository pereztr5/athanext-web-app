import type { ReactNode } from "react";
import { SquareCheck } from "lucide-react";
import { CoachProfileCard, CoachProfileCardHeader } from "./CoachProfileCard";

interface Certification {
  id: string;
  certification_name: string;
  issuing_organization?: string;
}

interface CertificationsSectionProps {
  certifications?: Certification[];
  /** @deprecated no longer used by the brand-kit card */
  iconColor?: string;
  /** @deprecated no longer used by the brand-kit card */
  certBg?: string;
  /** @deprecated no longer used by the brand-kit card */
  certIcon?: string;
  /** Optional header actions, e.g. an Edit button in edit mode. */
  actions?: ReactNode;
}

export function CertificationsSection({ certifications, actions }: CertificationsSectionProps) {
  const items = certifications ?? [];

  return (
    <CoachProfileCard>
      <CoachProfileCardHeader title="Certifications & credentials" actions={actions} />
      {items.length === 0 ? (
        <p className="text-[16px] leading-[18px] tracking-[-0.03em] text-[#A3A6AB]">No certifications added yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {items.map((cert, idx) => (
            <div
              key={cert.id || idx}
              className="flex items-start gap-[10px] rounded-[10px] border border-[#EAEADF] bg-[#F4F4EB] p-[15px]"
            >
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#CBE7D1] text-[#1E7431]">
                <SquareCheck className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[16px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]">
                  {cert.certification_name || "Certification"}
                </p>
                {cert.issuing_organization ? (
                  <p className="mt-1 truncate text-[12px] leading-[14px] tracking-[-0.03em] text-[#A3A6AB]">
                    {cert.issuing_organization}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </CoachProfileCard>
  );
}
