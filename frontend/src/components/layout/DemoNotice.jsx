import { Link } from 'react-router-dom';
import { Alert } from '../ui/Alert';
import { useAppData } from '../../context/AppDataContext';

// Shown on module pages while in demo mode so nobody mistakes demo output for
// backend output.
export function DemoNotice({ children }) {
  const { mode } = useAppData();
  if (mode !== 'demo') return null;
  return (
    <Alert tone="demo" title="Demo mode" className="demo-notice">
      {children} Data is stored only in this browser. <Link to="/settings">Settings</Link> switches to the FastAPI backend.
    </Alert>
  );
}
