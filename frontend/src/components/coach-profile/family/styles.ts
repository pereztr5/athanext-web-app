/** Family coach profile class strings (Working Copy `.sp2-*`). */

/** Card heading (`.h3.sp2-h`). */
export const sectionTitle = "text-[20px] font-medium leading-[18px] tracking-[-0.05em] text-[#1A202C]";
export const caption = "text-[12px] leading-[14px] tracking-[-0.03em] text-[#767980]";
export const lbl = "text-[12px] font-medium leading-[13px] tracking-[-0.03em] text-[#767980]";
export const medium = "text-[14px] font-medium leading-[18px] tracking-[-0.03em] text-[#1A202C]";
/** `.sp2-card`: the shared card with an 18px gap. */
export const cardGap = "gap-[18px]";

export const money = (dollars: number) => `$${Math.round(dollars).toLocaleString("en-US")}`;
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
