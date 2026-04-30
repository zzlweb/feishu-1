import { Routes, Route, Navigate } from 'react-router-dom';
import DocumentList from './components/DocumentList/DocumentList';
import DocumentPage from './components/Layout/DocumentPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<DocumentList />} />
      <Route path="/doc/:id" element={<DocumentPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
