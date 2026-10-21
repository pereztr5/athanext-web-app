import { FEE_CONFIG_KEYS, type FeeConfig, parseFeeConfig } from "./fees.ts";

/** Any Supabase client (service role or the caller's): configurations is readable by both. */
type ConfigClient = {
  // deno-lint-ignore no-explicit-any
  from: (table: string) => any;
};

/** The current fee rates. Throws when they can't be read, so nothing is charged at a wrong rate. */
export const loadFeeConfig = async (client: ConfigClient): Promise<FeeConfig> => {
  const { data, error } = await client.from("configurations").select("key,value").in("key", FEE_CONFIG_KEYS);
  if (error) throw error;
  return parseFeeConfig(data as { key: string; value: unknown }[] | null);
};
