import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { useTermsAndConditions } from '@/hooks/useTermsAndConditions';
import { sanitizeHTML } from '@/utils/sanitize';
import { formatDateToUSA } from '@/utils/helperFunctions';
import '@/styles/privacyPolicy-termsCondition.css';
import PolicyLoadingSkeleton from '@/components/PolicyLoadingSkeleton';

const TermsAndConditions = () => {
  const { termsAndConditions, loading, error, refetch } = useTermsAndConditions();

  if (loading) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-background to-primary/5">
        <PolicyLoadingSkeleton />
      </div>
    );
  }

  if (error || !termsAndConditions) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-background to-primary/5">
        <div className="max-w-8xl mx-auto">
          <Card className="border border-red-500/20 bg-red-500/5 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                    Unable to Load Terms & Conditions
                  </h3>
                  <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                    {error || 'An unexpected error occurred. Please try again.'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refetch}
                    className="border-red-500/30 hover:bg-red-500/10"
                  >
                    Try Again
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
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-background to-primary/5">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-slate-800 dark:text-slate-200">
            {termsAndConditions.title}
          </h1>
        </div>

        <Card className="border border-primary/20 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6 sm:p-8">
            <div
              className="content-wrapper prose prose-sm sm:prose-base dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: sanitizeHTML(termsAndConditions.content),
              }}
            />

            <div className="mt-8 pt-8 border-t border-primary/10">
              <p className="text-sm text-muted-foreground">
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
