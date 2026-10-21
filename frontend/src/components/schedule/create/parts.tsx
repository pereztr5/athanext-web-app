/** Avatar, summary card and form hints for the Create session sheet (Working Copy 2 `.av`, `.cs-ready`). */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { missingLine } from "@/utils/sessionForm";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

/** `.av.av-n`: photo when there is one, initials otherwise. */
export const Avatar = ({ name, imageUrl, size = 26 }: { name: string; imageUrl?: string | null; size?: number }) =>
  imageUrl ? (
    <img src={imageUrl} alt="" className="flex-none rounded-full border border-light-550 object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-full border border-light-550 bg-light text-dark-400",
        size >= 40 ? "text-label-sm" : "text-label-xsm"
      )}
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  );

/** `.cs-ready`: what was just created, on green. */
export const ReadyCard = ({ icon, title, caption }: { icon: ReactNode; title: string; caption: string }) => (
  <div className="flex items-center gap-2.5 rounded-card border border-success-300 bg-success-50 p-3 text-success-700 [&>svg]:size-5 [&>svg]:flex-none">
    {icon}
    <span className="flex min-w-0 grow flex-col gap-0.5">
      <b className="text-label-sm text-success-800">{title}</b>
      <span className="text-caption text-success-800">{caption}</span>
    </span>
  </div>
);

/** The line above a disabled primary button: what's still missing. */
export const MissingNote = ({ missing, className }: { missing: string[]; className?: string }) =>
  missing.length ? (
    <p className={cn("text-caption text-dark-300", className)} aria-live="polite">
      {missingLine(missing)}
    </p>
  ) : null;

/** A field's own message: what to fix in it. */
export const FieldHint = ({ children, id }: { children: ReactNode; id?: string }) =>
  children ? (
    <span id={id} className="text-caption text-error-700">
      {children}
    </span>
  ) : null;
