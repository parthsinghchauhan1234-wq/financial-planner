import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Storage adapter (same as before)
window.storage = {
  async get(key) {
    try {
      const res = await fetch(`http://localhost:3001/api/storage/${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error('Storage read failed');
      return res.json();
    } catch (e) {
      console.error('Storage.get error:', e);
      return null;
    }
  },
  async set(key, value) {
    try {
      await fetch(`http://localhost:3001/api/storage/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
    } catch (e) { console.error('Storage.set error:', e); }
  },
  async delete(key) {
    try {
      await fetch(`http://localhost:3001/api/storage/${encodeURIComponent(key)}`, { method: 'DELETE' });
    } catch (e) { console.error('Storage.delete error:', e); }
  },
};

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', color: '#A8503D' }}>
          <h2>Something went wrong</h2>
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);