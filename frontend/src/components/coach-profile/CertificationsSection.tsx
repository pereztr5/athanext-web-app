import type { ReactNode } from "react";
import { SquareCheck } from "@/components/icons";
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
        <p className="text-body-m text-dark-300">No certifications added yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {items.map((cert, idx) => (
            <div
              key={cert.id || idx}
              className="flex items-start gap-[10px] rounded-card border border-light-525 bg-light-400 p-[15px]"
            >
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-card border border-success-300 bg-success-100 text-success-700">
                <SquareCheck className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-subtitle text-dark">
                  {cert.certification_name || "Certification"}
                </p>
                {cert.issuing_organization ? (
                  <p className="mt-1 truncate text-caption text-dark-300">
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
