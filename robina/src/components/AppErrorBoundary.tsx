import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export default class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || "Unknown runtime error",
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AppErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6 bg-background text-foreground">
          <div className="max-w-md w-full glass-card rounded-2xl p-6 space-y-3 text-center">
            <h1 className="text-xl font-bold">Robina could not start</h1>
            <p className="text-sm text-muted-foreground break-words">
              {import.meta.env.DEV ? this.state.message : "Reload the application to restore your session."}
            </p>
            <button
              className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold"
              onClick={() => window.location.reload()}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
