import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="relative flex min-h-[100dvh] w-full items-center justify-center p-6">
          <div className="fixed inset-0 -z-10 overflow-hidden opacity-30">
            <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          </div>
          <div className="glass-card-glow relative z-10 mx-auto w-full max-w-lg animate-scale-in space-y-6 p-6 text-center sm:p-8">
            <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">Something Went Wrong</h1>
            <p className="text-muted-foreground leading-relaxed">
              An unexpected error occurred. Don't worry — your data is safe. Please try reloading the page.
            </p>
            {this.state.error && (
              <details className="text-left rounded-lg border border-border bg-muted/30 p-3 text-xs">
                <summary className="cursor-pointer text-muted-foreground font-medium">Error Details</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words text-destructive/80 font-mono">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="rounded-lg border border-border bg-muted/50 px-6 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
