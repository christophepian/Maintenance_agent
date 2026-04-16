import React from "react";

/**
 * ErrorBoundary — catches uncaught render errors and displays a recovery UI
 * instead of a blank white screen. Wraps the entire app in _app.js.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to console in dev; could send to monitoring in production
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="min-h-screen flex items-center justify-center bg-slate-50 p-8"
        >
          <div className="max-w-md w-full text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h1 className="text-xl font-semibold text-slate-900">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-500">
              An unexpected error occurred. Please try reloading the page.
            </p>
            {process.env.NODE_ENV !== "production" && this.state.error && (
              <pre className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-left text-xs text-red-700 overflow-auto max-h-40">
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack}
              </pre>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="button-primary mt-4"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
