/** Family coach profile class strings (Working Copy `.sp2-*`). */

/** Card heading (`.h3.sp2-h`). */
export const sectionTitle = "text-card-title text-dark";
export const caption = "text-caption text-dark-300";
export const lbl = "text-label-xsm text-dark-300";
export const medium = "text-label-sm text-dark";
/** `.sp2-card`: the shared card with an 18px gap. */
export const cardGap = "gap-[18px]";

export const money = (dollars: number) => `$${Math.round(dollars).toLocaleString("en-US")}`;
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
