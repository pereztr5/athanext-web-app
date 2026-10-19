import type { ReactNode } from "react";
import { Check, ShieldCheck } from "@/components/icons";
import { BrandPill } from "@/components/brand";
import "@/styles/richText.css";
import { CoachProfileCard } from "../CoachProfileCard";
import { cardGap, lbl, sectionTitle } from "./styles";

const TagRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-2.5">
    <span className={`${lbl} pt-1`}>{label}</span>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
);

/** About (Working Copy `.sp2-tr`, `.sp2-bio`, `.sp2-creds`): Coaches, Levels, Pillars, bio, credentials. */
export const AboutCard = ({
  coaches,
  ages,
  levels,
  pillars,
  bioHtml,
  credentials,
}: {
  /** "Soccer · Field players" */
  coaches: string;
  /** "Ages 10 to 19", or "" */
  ages: string;
  levels: string[];
  pillars: string[];
  bioHtml: string;
  credentials: string[];
}) => (
  <CoachProfileCard className={cardGap} aria-label="About">
    <h2 className={sectionTitle}>About</h2>
    <div className="flex flex-col gap-2.5">
      <TagRow label="Coaches">
        <BrandPill tone="teal">{coaches}</BrandPill>
        {ages ? <BrandPill tone="sunk">{ages}</BrandPill> : null}
      </TagRow>
      {levels.length ? (
        <TagRow label="Levels">
          {levels.map((level) => (
            <BrandPill key={level} className="border border-light-550 bg-light text-dark">
              {level}
            </BrandPill>
          ))}
        </TagRow>
      ) : null}
      {pillars.length ? (
        <TagRow label="Pillars">
          {pillars.map((pillar) => (
            <BrandPill key={pillar} tone="blue">
              {pillar}
            </BrandPill>
          ))}
        </TagRow>
      ) : null}
    </div>
    {bioHtml ? (
      <div
        className="rich-text-content text-body-l text-dark"
        dangerouslySetInnerHTML={{ __html: bioHtml }}
      />
    ) : null}
    {credentials.length ? (
      <div className="flex flex-wrap gap-x-[18px] gap-y-2">
        {credentials.map((name) => {
          const Icon = /background/i.test(name) ? ShieldCheck : Check;
          return (
            <span key={name} className="inline-flex items-center gap-1.5 text-label-sm text-dark-400">
              <Icon className="size-4 shrink-0 text-success-700" strokeWidth={1.5} aria-hidden="true" />
              {name}
            </span>
          );
        })}
      </div>
    ) : null}
  </CoachProfileCard>
);
