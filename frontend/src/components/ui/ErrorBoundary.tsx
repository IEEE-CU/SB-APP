import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="bg-canvas-soft rounded-xl p-8 text-center">
            <p className="text-heading-3 font-bold text-ink mb-2">
              Something went wrong
            </p>
            <p className="text-body-sm text-ink-muted">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 bg-primary text-on-primary text-button rounded-full hover:bg-primary-active"
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
