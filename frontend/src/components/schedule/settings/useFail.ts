import { useToast } from "@/hooks/use-toast";

/** Error toast for the Schedule settings mutations. */
export const useFail = () => {
  const { toast } = useToast();
  return (err: unknown) =>
    toast({ title: "Something went wrong", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
};
