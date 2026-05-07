import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'tdesign-react';
import zhCN from 'tdesign-react/es/locale/zh_CN';
import DocumentList from './components/DocumentList/DocumentList';
import DocumentPage from './components/Layout/DocumentPage';

function App() {
  return (
    <ConfigProvider globalConfig={zhCN}>
      <Routes>
        <Route path="/" element={<DocumentList />} />
        <Route path="/doc/:id" element={<DocumentPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
