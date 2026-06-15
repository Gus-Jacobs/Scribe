import React from 'react';

type State = { error: Error | null; info: React.ErrorInfo | null };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  constructor(props: any) {
    super(props);
    this.state = { error: null, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
    try {
      // also surface to window for easier capture in renderer devtools
      (window as any).__LAST_REACT_ERROR__ = { error: String(error), stack: error.stack, info };
    } catch (e) {}
    this.setState({ error, info });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, color: 'white', background: '#b91c1c', position: 'fixed', inset: 20, zIndex: 9999, overflow: 'auto' }}>
          <h2>Application error</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.toString()}
{this.state.error?.stack}</pre>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>
            {this.state.info && (this.state.info.componentStack || JSON.stringify(this.state.info, null, 2))}
          </details>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => { try { location.reload(); } catch(e){} }} style={{ padding: '8px 12px', borderRadius: 6 }}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}
