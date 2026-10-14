import { Component, type ReactNode } from 'react';

/** If something breaks, show a way back instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif', color: '#eee', background: '#0b0b14' }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ opacity: 0.75, margin: '0 0 20px' }}>Your progress is saved. Reloading usually fixes it.</p>
          <button
            type="button"
            onClick={() => location.reload()}
            style={{ padding: '12px 22px', borderRadius: 999, border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
