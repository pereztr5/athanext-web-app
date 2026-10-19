import { Card, CardContent } from '@/components/ui/card';

const PolicyLoadingSkeleton = () => {
  return (
    <div className="mx-auto flex w-full max-w-wrapper flex-col gap-6">
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-3/4 rounded-control bg-light-525 md:h-10" />
        <div className="h-4 w-1/3 rounded-pill bg-light-525" />
      </div>
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="space-y-4 animate-pulse">
            <div className="h-5 w-full rounded-pill bg-light-525" />
            <div className="h-5 w-11/12 rounded-pill bg-light-525" />
            <div className="h-5 w-10/12 rounded-pill bg-light-525" />
            <div className="h-5 w-9/12 rounded-pill bg-light-525" />
            <div className="h-5 w-8/12 rounded-pill bg-light-525" />
            <div className="h-5 w-10/12 rounded-pill bg-light-525" />
            <div className="h-5 w-7/12 rounded-pill bg-light-525" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PolicyLoadingSkeleton;
