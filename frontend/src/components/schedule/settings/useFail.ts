import { errorMessage } from "@/utils/errorMessage";
import { useToast } from "@/hooks/use-toast";

/** Error toast for the Schedule settings mutations. */
export const useFail = () => {
  const { toast } = useToast();
  return (err: unknown) =>
    toast({ title: "Something went wrong", description: errorMessage(err, "Please try again."), variant: "destructive" });
};
