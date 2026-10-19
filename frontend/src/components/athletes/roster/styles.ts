/** My Athletes class strings (Working Copy `.athcard`, `.sel-chip`, `.arow`). */

/** The roster card drops its chrome on phone; inputs then sit on the page with a card background. */
export const rosterCard =
  "flex min-w-0 flex-col gap-5 rounded-card border border-light-525 bg-light-300 px-[25px] pb-[25px] pt-[30px] max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0";

/** Phone: inputs inside the roster card get the card background and a line. */
export const rosterInputPhone = "max-md:border max-md:border-light-525 max-md:bg-light-300";

export const selChip =
  "h-[34px] w-full appearance-none md:w-auto rounded-control border border-light-525 bg-light-400 pl-3 pr-8 text-label-sm text-dark focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary max-md:bg-light-300";

/** Desktop columns: athlete, next session, package, position, Book. */
export const rosterGrid =
  "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 md:grid-cols-[minmax(0,2.3fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_150px_64px] md:gap-4";

/** Initials avatar (Working Copy `.av.av-n` at 34px). */
export const avatar =
  "flex size-[34px] flex-none items-center justify-center overflow-hidden rounded-full bg-light text-label-xsm text-dark-400 max-md:border max-md:border-light-550 max-md:bg-light-300";

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
