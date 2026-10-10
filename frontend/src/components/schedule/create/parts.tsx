/** Avatar and summary card for the Create session sheet (Working Copy 2 `.av`, `.cs-ready`). */
import type { ReactNode } from "react";

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
    <img src={imageUrl} alt="" className="flex-none rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden="true"
      className="inline-flex flex-none items-center justify-center rounded-full bg-[#F1F1E6] font-medium tracking-[-0.03em] text-[#484D56]"
      style={{ width: size, height: size, fontSize: size >= 40 ? 14 : 12 }}
    >
      {initials(name)}
    </span>
  );

/** `.cs-ready`: what was just created, on green. */
export const ReadyCard = ({ icon, title, caption }: { icon: ReactNode; title: string; caption: string }) => (
  <div className="flex items-center gap-2.5 rounded-[12px] bg-[#DDEFE1] p-3 text-[#1E7431] [&>svg]:size-5 [&>svg]:flex-none">
    {icon}
    <span className="flex min-w-0 grow flex-col gap-0.5">
      <b className="text-[15px] font-semibold leading-[18px] text-[#1F5A31]">{title}</b>
      <span className="text-[12px] leading-[14px] text-[#2E6B3F]">{caption}</span>
    </span>
  </div>
);
