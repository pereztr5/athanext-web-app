import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { AlertCircle } from "@/components/icons";
import { useTermsAndConditions } from '@/hooks/useTermsAndConditions';
import { sanitizeHTML } from '@/utils/sanitize';
import { formatDateToUSA } from '@/utils/helperFunctions';
import '@/styles/privacyPolicy-termsCondition.css';
import PolicyLoadingSkeleton from '@/components/common/PolicyLoadingSkeleton';
import { usePolicyPageClass } from '@/hooks/usePolicyPageClass';

const TermsAndConditions = () => {
  const { termsAndConditions, loading, error, refetch } = useTermsAndConditions();
  const pageClass = usePolicyPageClass();

  if (loading) {
    return (
      <div className={pageClass}>
        <PolicyLoadingSkeleton />
      </div>
    );
  }

  if (error || !termsAndConditions) {
    return (
      <div className={pageClass}>
        <div className="mx-auto w-full max-w-wrapper">
          <Card className="border-error-300 bg-error-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="mt-0.5 size-5 flex-shrink-0 text-error-600" strokeWidth={1.5} />
                <div className="flex flex-1 flex-col gap-2">
                  <h3 className="text-subtitle text-error-700">
                    Couldn't load the terms and conditions
                  </h3>
                  <p className="text-body-m text-error-700">
                    {error || 'Something went wrong. Try again.'}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={refetch}
                    className="self-start"
                  >
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

  return (
    <div className={pageClass}>
      <div className="mx-auto flex w-full max-w-wrapper flex-col gap-6">
        <PageHeader title={termsAndConditions.title} />

        <Card>
          <CardContent className="p-6 sm:p-8">
            <div
              className="content-wrapper prose prose-sm sm:prose-base dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: sanitizeHTML(termsAndConditions.content),
              }}
            />

            <div className="mt-8 border-t border-light-525 pt-8">
              <p className="text-caption text-dark-300">
                Last updated: {formatDateToUSA(termsAndConditions.last_updated)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TermsAndConditions;
