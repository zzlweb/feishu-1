import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'tdesign-react';
import zhCN from 'tdesign-react/es/locale/zh_CN';
import DocumentList from './components/DocumentList/DocumentList';

const DocumentPage = lazy(() => import('./components/Layout/DocumentPage'));

function DocumentPageFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'grid',
        minHeight: '100vh',
        placeItems: 'center',
        color: '#646a73',
        background: '#fff',
        fontSize: 14,
      }}
    >
      正在加载文档…
    </div>
  );
}

function App() {
  return (
    <ConfigProvider globalConfig={zhCN}>
      <Routes>
        <Route path="/" element={<DocumentList />} />
        <Route
          path="/doc/:id"
          element={(
            <Suspense fallback={<DocumentPageFallback />}>
              <DocumentPage />
            </Suspense>
          )}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
