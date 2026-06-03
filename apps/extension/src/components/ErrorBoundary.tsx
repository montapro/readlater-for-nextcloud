import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ReadLater: ErrorBoundary caught", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-[500px] min-h-[500px] bg-background text-foreground flex flex-col items-center justify-center p-8 text-center gap-3">
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
            <span className="text-destructive font-bold text-xl">!</span>
          </div>
          <h2 className="font-bold text-lg">Something went wrong</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors cursor-pointer"
          >
            Reload Extension
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
