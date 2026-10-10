/** Browse card pill (Working Copy `pill('Free intro call', 'blue')`). */
import { BrandPill } from "@/components/brand";

export const FreeIntroPill = ({ enabled }: { enabled: boolean }) => (enabled ? <BrandPill tone="blue">Free intro call</BrandPill> : null);
