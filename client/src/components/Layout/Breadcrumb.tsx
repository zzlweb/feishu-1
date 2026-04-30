import { useNavigate } from 'react-router-dom';

interface BreadcrumbProps {
  items: { label: string; path?: string }[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  const navigate = useNavigate();

  return (
    <nav className="breadcrumb">
      {items.map((item, idx) => (
        <span key={idx} className="breadcrumb-item">
          {item.path ? (
            <button
              className="breadcrumb-link"
              onClick={() => navigate(item.path!)}
            >
              {item.label}
            </button>
          ) : (
            <span className="breadcrumb-current">{item.label}</span>
          )}
          {idx < items.length - 1 && (
            <span className="breadcrumb-sep">›</span>
          )}
        </span>
      ))}
    </nav>
  );
}
