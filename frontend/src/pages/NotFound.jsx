import { Compass } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/States';
import { Button } from '../components/ui/Button';

export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <>
      <PageHeader title="Page not found" description="The address you opened does not match any page in RADIX Talent Match." />
      <Card>
        <EmptyState
          icon={Compass}
          title={`Nothing lives at ${pathname}`}
          description="Check the address, or continue from the dashboard."
          actions={
            <>
              <Button variant="primary" to="/">
                Go to dashboard
              </Button>
              <Button to="/results">View results</Button>
            </>
          }
        />
      </Card>
    </>
  );
}
