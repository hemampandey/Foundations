'use client';

import React, { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Catches unhandled errors and renders a fallback */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Foundations] Uncaught error:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 mb-5"><AlertTriangle className="w-7 h-7" /></div>
          <h2 className="text-xl font-bold font-display text-foreground mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6">An unexpected error occurred. Please try reloading the page. If the issue persists, contact your administrator.</p>
          <button onClick={this.handleReload} className="px-5 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer shadow-md shadow-primary/10">Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}
