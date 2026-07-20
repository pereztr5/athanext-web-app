import { usePrivacyPolicy } from '@/hooks/usePrivacyPolicy';
import { AlertCircle } from 'lucide-react';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import ScrollToTop from '@/components/common/ScrollToTop';
import { formatDateToUSA } from '@/utils/helperFunctions';
import { sanitizeHTML } from '@/utils/sanitize';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import '@/styles/privacyPolicy-termsCondition.css';
import PolicyLoadingSkeleton from '@/components/common/PolicyLoadingSkeleton';


export default function PrivacyPolicy() {
  const { policy, loading, error, hasContent } = usePrivacyPolicy();

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-background to-primary/5">
      <ScrollToTop />
      <ErrorBoundary>
        {/* Loading State */}
        {loading && (
          <PolicyLoadingSkeleton />
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="max-w-8xl mx-auto">
            <Card className="border border-red-500/20 bg-red-500/5 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                      Unable to Load Privacy Policy
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                      {error}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.reload()}
                      className="border-red-500/30 hover:bg-red-500/10"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!loading && !hasContent && !error && (
          <div className="max-w-8xl mx-auto">
            <Card className="border border-yellow-500/20 bg-yellow-500/5 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-yellow-900 mb-2">
                      No Content Available
                    </h3>
                    <p className="text-sm text-yellow-800">
                      The privacy policy content is not available at this time. Please check back later.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Content */}
        {!loading && hasContent && policy && (
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-slate-800 dark:text-slate-200">
                {policy.title || 'Privacy Policy'}
              </h1>
            </div>

            <Card className="border border-primary/20 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6 sm:p-8">
                <div
                  className="content-wrapper prose prose-sm sm:prose-base dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(policy.content) }}
                />

                <div className="mt-8 pt-8 border-t border-primary/10">
                  {policy.last_updated && (
                    <p className="text-sm text-muted-foreground">
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
