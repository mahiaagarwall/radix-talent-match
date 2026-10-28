import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@cd/components/ui/button";
import { Skeleton } from "@cd/components/ui/skeleton";
import { DIRECTORY_PATHS } from "@cd/routes";

export const PageSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <div className="space-y-4 py-4" aria-busy="true" aria-label="Loading" data-testid="page-skeleton">
    <Skeleton className="h-14 w-full rounded-xl" />
    {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
  </div>
);

export const PageError = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="flex flex-col items-center gap-3 px-4 py-20 text-center" role="alert">
    <AlertTriangle className="h-8 w-8 text-error" aria-hidden />
    <p className="max-w-xl font-medium">{message}</p>
    <div className="flex gap-2">
      {onRetry && <Button onClick={onRetry}>Retry</Button>}
      <Button asChild variant="outline"><Link to={DIRECTORY_PATHS.home}>All companies</Link></Button>
    </div>
  </div>
);
