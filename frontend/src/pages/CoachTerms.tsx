import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { AlertCircle } from "@/components/icons";
import { getCoachTerms } from "@/api/coach-terms";
import { sanitizeHTML } from "@/utils/sanitize";
import { formatDateToUSA } from "@/utils/helperFunctions";
import "@/styles/privacyPolicy-termsCondition.css";
import PolicyLoadingSkeleton from "@/components/common/PolicyLoadingSkeleton";
import { usePolicyPageClass } from "@/hooks/usePolicyPageClass";
import { ROUTES } from "@/routes";

/**
 * Public /coach-terms: the active row of public.coach_terms, same layout as Terms. With no
 * published coach terms it replaces itself with the Terms and conditions page.
 */
const CoachTerms = () => {
  const pageClass = usePolicyPageClass();
  const query = useQuery({ queryKey: ["coach-terms"], queryFn: getCoachTerms, staleTime: Infinity });

  if (query.isLoading) {
    return (
      <div className={pageClass}>
        <PolicyLoadingSkeleton />
      </div>
    );
  }

  if (query.error) {
    return (
      <div className={pageClass}>
        <div className="mx-auto w-full max-w-wrapper">
          <Card className="border-error-300 bg-error-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="mt-0.5 size-5 flex-shrink-0 text-error-600" strokeWidth={1.5} />
                <div className="flex flex-1 flex-col gap-2">
                  <h3 className="text-subtitle text-error-700">Couldn't load the coach terms</h3>
                  <p className="text-body-m text-error-700">Something went wrong. Try again.</p>
                  <Button variant="secondary" size="sm" onClick={() => query.refetch()} className="self-start">
                    Try again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const doc = query.data;
  if (!doc) return <Navigate to={ROUTES.TERMS_AND_CONDITIONS} replace />;

  return (
    <div className={pageClass}>
      <div className="mx-auto flex w-full max-w-wrapper flex-col gap-6">
        <PageHeader title={doc.title} />
        <Card>
          <CardContent className="p-6 sm:p-8">
            <div
              className="content-wrapper prose prose-sm sm:prose-base dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHTML(doc.content) }}
            />
            {doc.lastUpdated ? (
              <div className="mt-8 border-t border-light-525 pt-8">
                <p className="text-caption text-dark-300">Last updated: {formatDateToUSA(doc.lastUpdated)}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CoachTerms;
