import { usePrivacyPolicy } from '@/hooks/usePrivacyPolicy';
import { AlertCircle } from "@/components/icons";
import ErrorBoundary from '@/components/common/ErrorBoundary';
import ScrollToTop from '@/components/common/ScrollToTop';
import { formatDateToUSA } from '@/utils/helperFunctions';
import { sanitizeHTML } from '@/utils/sanitize';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import '@/styles/privacyPolicy-termsCondition.css';
import PolicyLoadingSkeleton from '@/components/common/PolicyLoadingSkeleton';
import { usePolicyPageClass } from '@/hooks/usePolicyPageClass';


export default function PrivacyPolicy() {
  const { policy, loading, error, hasContent } = usePrivacyPolicy();
  const pageClass = usePolicyPageClass();

  return (
    <div className={pageClass}>
      <ScrollToTop />
      <ErrorBoundary>
        {/* Loading state */}
        {loading && (
          <PolicyLoadingSkeleton />
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="mx-auto w-full max-w-wrapper">
            <Card className="border-error-300 bg-error-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="mt-0.5 size-5 flex-shrink-0 text-error-600" strokeWidth={1.5} />
                  <div className="flex flex-1 flex-col gap-2">
                    <h3 className="text-subtitle text-error-700">
                      Couldn't load the privacy policy
                    </h3>
                    <p className="text-body-m text-error-700">
                      {error}
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => window.location.reload()}
                      className="self-start"
                    >
                      Try again
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty state */}
        {!loading && !hasContent && !error && (
          <div className="mx-auto w-full max-w-wrapper">
            <Card className="border-info-300 bg-info-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="mt-0.5 size-5 flex-shrink-0 text-info-700" strokeWidth={1.5} />
                  <div className="flex flex-1 flex-col gap-2">
                    <h3 className="text-subtitle text-info-700">
                      No content yet
                    </h3>
                    <p className="text-body-m text-info-700">
                      The privacy policy isn't available right now. Check back later.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Content */}
        {!loading && hasContent && policy && (
          <div className="mx-auto flex w-full max-w-wrapper flex-col gap-6">
            <PageHeader title={policy.title || 'Privacy policy'} />

            <Card>
              <CardContent className="p-6 sm:p-8">
                <div
                  className="content-wrapper prose prose-sm sm:prose-base dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(policy.content) }}
                />

                <div className="mt-8 border-t border-light-525 pt-8">
                  {policy.last_updated && (
                    <p className="text-caption text-dark-300">
                      Last updated: {formatDateToUSA(policy.last_updated)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}
