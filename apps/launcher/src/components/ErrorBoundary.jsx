import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleDismiss = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-timsys-dark flex items-center justify-center px-4">
          <div className="max-w-md w-full">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.67 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h1 className="text-xl font-bold text-white">Something went wrong</h1>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                An unexpected error occurred. You can try reloading the page or going back.
              </p>
              {this.state.error?.message && (
                <div className="bg-gray-800 border border-gray-700 rounded p-3 mb-4">
                  <p className="text-xs text-gray-500 mb-1">Error:</p>
                  <p className="text-sm text-red-400 font-mono break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}
              {this.state.errorInfo?.componentStack && (
                <details className="mb-4">
                  <summary className="text-gray-400 text-xs cursor-pointer hover:text-gray-300">
                    Component stack
                  </summary>
                  <pre className="text-xs text-gray-600 mt-2 overflow-auto max-h-40">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
              <div className="flex gap-3">
                <button
                  onClick={this.handleDismiss}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm"
                >
                  Try Again
                </button>
                <button
                  onClick={this.handleReload}
                  className="bg-timsys-primary hover:bg-timsys-secondary text-white px-4 py-2 rounded text-sm"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
