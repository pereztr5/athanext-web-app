import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Compass } from "@/components/icons";
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
    <div className="flex min-h-[calc(100svh-3.8rem)] items-center justify-center bg-light px-4 font-sans">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-5 rounded-card border border-light-525 bg-light-300 px-[25px] pb-[25px] pt-[30px] text-center">
        <span className="inline-flex size-10 items-center justify-center rounded-control border border-light-525 bg-light-400 text-dark-300" aria-hidden="true">
          <Compass className="size-5" strokeWidth={1.5} />
        </span>
        <div className="flex flex-col gap-[10px]">
          <p className="text-label-xsm text-dark-300">Error 404</p>
          <h1 className="text-page-title-phone text-dark md:text-page-title">Page not found</h1>
          <p className="text-body-l text-dark-300">
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
