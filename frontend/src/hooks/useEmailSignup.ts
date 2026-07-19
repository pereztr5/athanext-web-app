import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address" }).min(1, { message: "Email is required" })
});

export const useEmailSignup = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string }>({});
  const { toast } = useToast();
  const { user } = useAuth();

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (user) {
      toast({
        title: "Already signed in!",
        description: "You're already logged in to your account.",
      });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      // Validate email
      emailSchema.parse({ email });
      
      // Redirect to auth page with email pre-filled and signup mode active
      window.location.href = `/auth?email=${encodeURIComponent(email)}&mode=signup`;
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors({ email: error.issues[0]?.message });
      } else {
        toast({
          title: "Something went wrong",
          description: "Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    email,
    setEmail,
    isLoading,
    errors,
    handleEmailSignup
  };
};