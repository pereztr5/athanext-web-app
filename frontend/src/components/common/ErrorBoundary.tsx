import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[200px] items-center justify-center p-6 font-sans tracking-[-0.03em]">
          <div className="flex w-full max-w-md flex-col items-center gap-2.5 rounded-[10px] border border-[#EAEADF] bg-[#F7F7F0] px-[25px] pb-[25px] pt-[30px] text-center">
            <AlertTriangle strokeWidth={1.5} className="h-8 w-8 text-destructive" />
            <h2 className="text-[20px] font-medium leading-[24px] tracking-[-0.05em] text-[#1A202C]">
              Something went wrong
            </h2>
            <p className="text-[14px] leading-[18px] text-[#767980]">
              Refreshing the page usually fixes this.
            </p>
            <Button className="mt-2.5" onClick={() => window.location.reload()}>
              Refresh page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
