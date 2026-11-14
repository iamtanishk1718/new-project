import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Unexpected rendering error.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Mission Control ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#05070C] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-slate-900/95 border border-rose-500/50 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400 font-mono font-bold text-sm uppercase">
              <AlertTriangle className="w-5 h-5" />
              <span>Mission Control Recovery Mode</span>
            </div>
            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-mono transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Telemetry Console</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
