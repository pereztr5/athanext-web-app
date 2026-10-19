import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from "@/components/icons";

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
        <div className="flex min-h-[200px] items-center justify-center p-6 font-sans">
          <div className="flex w-full max-w-md flex-col items-center gap-2.5 rounded-card border border-light-525 bg-light-300 px-[25px] pb-[25px] pt-[30px] text-center">
            <AlertTriangle strokeWidth={1.5} className="size-6 text-error-600" />
            <h2 className="text-card-title text-dark">
              Something went wrong
            </h2>
            <p className="text-body-m text-dark-300">
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
