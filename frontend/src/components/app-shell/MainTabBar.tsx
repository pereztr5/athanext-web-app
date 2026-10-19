import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { isNavActive, type NavItem } from "./nav";

/** Phone bottom tab bar (ATH-75 coaches, ATH-91 athletes). */
export const MainTabBar = ({ items, badges }: { items: NavItem[]; badges?: Record<string, number> }) => {
  const location = useLocation();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-light-525 bg-light-300 px-1 pb-[calc(8px+env(safe-area-inset-bottom))] pt-1.5 md:hidden"
    >
      {items.map((item) => {
        const active = isNavActive(item, location.pathname);
        return (
          <Link
            key={item.url}
            to={item.url}
            aria-current={active ? "page" : undefined}
            aria-label={badges?.[item.url] ? `${item.short}, ${badges[item.url]} overdue` : undefined}
            className={cn(
              "flex min-h-target flex-1 flex-col items-center gap-[3px] py-1 text-label-xsm",
              active ? "text-primary" : "text-dark-300"
            )}
          >
            {/* The active tab adds a shape cue, so it isn't marked by colour alone. */}
            <span
              className={cn(
                "relative rounded-control border px-3 py-[3px]",
                active ? "border-primary-400 bg-light" : "border-transparent"
              )}
            >
              <item.icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
              {badges?.[item.url] ? (
                <i className="absolute -right-1 -top-2 min-w-4 rounded-pill border border-error-300 bg-error-100 px-1 text-center text-label-xsm not-italic text-error-700">
                  {badges[item.url]}
                </i>
              ) : null}
            </span>
            {item.short}
          </Link>
        );
      })}
    </nav>
  );
};
