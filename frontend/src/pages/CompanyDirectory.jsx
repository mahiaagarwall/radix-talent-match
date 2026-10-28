import { Component, Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { titleForPath } from '../app/navigation';
import { LoadingState, ErrorState } from '../components/ui/States';
import NotFound from './NotFound';

// Loaded on demand so the directory's Supabase/React Query code never ships with the other pages.
const CompanyDirectoryRoutes = lazy(() => import('../features/company-directory/CompanyDirectoryRoutes'));

class DirectoryErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title="Could not open the Company Directory"
          error={this.state.error}
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}

export default function CompanyDirectory() {
  const { pathname } = useLocation();
  useDocumentTitle(titleForPath(pathname));
  return (
    <DirectoryErrorBoundary>
      <Suspense fallback={<LoadingState label="Loading Company Directory…" />}>
        <CompanyDirectoryRoutes notFound={<NotFound />} />
      </Suspense>
    </DirectoryErrorBoundary>
  );
}
