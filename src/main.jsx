import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PoolTable from './PoolTable';
import { applyContentUpdates } from './content-store';
import './styles.css';

const storageKey = 'cyber-pool-v1';
const queryClient = new QueryClient();
function App() {
  const [storageError, setStorageError] = useState(false);
  const [content, setContent] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch { return {}; }
  });
  const updateContent = useCallback(update => {
    setContent(previous => applyContentUpdates(previous, update));
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(content));
      setStorageError(false);
    } catch { setStorageError(true); }
  }, [content]);
  return <>
    <PoolTable content={content} updateContent={updateContent} />
    {storageError && <div role="status" className="save-warning">Browser storage is unavailable. Progress will last for this session only.</div>}
  </>;
}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);
