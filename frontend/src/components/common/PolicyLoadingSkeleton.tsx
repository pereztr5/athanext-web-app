import { Card, CardContent } from '@/components/ui/card';

const PolicyLoadingSkeleton = () => {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 space-y-4 animate-pulse">
        <div className="h-10 sm:h-12 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      </div>
      <Card className="border border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6 sm:p-8">
          <div className="space-y-4 animate-pulse">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-11/12" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-10/12" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-9/12" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-8/12" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-10/12" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-7/12" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PolicyLoadingSkeleton;
