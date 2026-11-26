import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unexpected biomechanics rendering fault.' };
  }

  componentDidCatch(error: Error): void {
    console.error('[LeverLab ErrorBoundary]', error);
  }

  private resetAll = (): void => {
    try {
      localStorage.removeItem('leverlab_workout_log_v1');
    } catch {
      // ignore storage errors
    }
    this.setState({ hasError: false, message: '' });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#101317] text-[#F1F5F9] flex items-center justify-center p-6">
          <div className="max-w-md w-full border border-[#2A323D] bg-[#171C22] p-6 space-y-3">
            <p className="font-mono-telemetry text-xs uppercase text-[#F59E0B]">Telemetry Recovery</p>
            <h1 className="font-display-lab text-lg font-bold">LeverLab recovered from an error</h1>
            <p className="text-xs text-[#94A3B8]">{this.state.message}</p>
            <button
              type="button"
              onClick={this.resetAll}
              className="px-4 py-2 bg-[#84CC16] text-[#101317] font-semibold text-xs cursor-pointer"
            >
              Reset Saved Log &amp; Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
