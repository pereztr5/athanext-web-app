import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";

interface BackToTopButtonProps {
  show: boolean;
}

export const BackToTopButton = ({ show }: BackToTopButtonProps) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!show) return null;

  return (
    <Button
      onClick={scrollToTop}
      className="fixed bottom-8 right-8 z-40 rounded-full h-12 w-12 p-0 shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in hover-scale"
      size="icon"
      aria-label="Back to top"
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
};