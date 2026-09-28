import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F1F1E6] px-4 font-sans">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px] text-center">
        <span className="inline-flex size-10 items-center justify-center rounded-[8px] bg-[#F4F4EB] text-[#767980]" aria-hidden="true">
          <Compass className="size-5" strokeWidth={1.5} />
        </span>
        <div className="flex flex-col gap-[10px]">
          <p className="text-[12px] font-medium leading-[14px] tracking-[-0.03em] text-[#767980]">Error 404</p>
          <h1 className="text-[32px] font-bold leading-[28px] tracking-[-0.05em] text-[#1A202C]">Page not found</h1>
          <p className="text-[16px] leading-[20px] tracking-[-0.03em] text-[#767980]">
            The page you're looking for doesn't exist or has moved.
          </p>
        </div>
        <Button asChild>
          <a href="/">Go home</a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
