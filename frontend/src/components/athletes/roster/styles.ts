/** My Athletes class strings (Working Copy `.athcard`, `.sel-chip`, `.arow`). */

/** The roster card drops its chrome on phone; inputs then sit on the page with a card background. */
export const rosterCard =
  "flex min-w-0 flex-col gap-[14px] rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px] max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0";

/** Phone: inputs inside the roster card get the card background and a line. */
export const rosterInputPhone = "max-md:border max-md:border-[#EAEADF] max-md:bg-[#F7F7F0]";

export const selChip =
  "h-[34px] w-full appearance-none md:w-auto rounded-[8px] border border-[#EAEADF] bg-[#F4F4EB] pl-3 pr-8 text-[14px] font-medium tracking-[-0.03em] text-[#1A202C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6698D2] max-md:bg-[#F7F7F0]";

/** Desktop columns: athlete, next session, package, position, Book. */
export const rosterGrid =
  "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-[10px] md:grid-cols-[minmax(0,2.3fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_150px_64px] md:gap-4";

/** Initials avatar (Working Copy `.av.av-n` at 34px). */
export const avatar =
  "flex size-[34px] flex-none items-center justify-center overflow-hidden rounded-full bg-[#F1F1E6] text-[12px] font-medium text-[#484D56] max-md:bg-[#F7F7F0] max-md:shadow-[inset_0_0_0_1px_#EAEADF]";

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
