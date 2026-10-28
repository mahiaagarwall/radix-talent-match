import type { ReactNode } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CompanyProvider } from "@cd/context/CompanyContext";
import { CompanyLayout } from "@cd/components/CompanyLayout";
import DirectoryHome from "@cd/pages/DirectoryHome";
import CompanyIntelligence from "@cd/pages/CompanyIntelligence";
import SkillIntelligence from "@cd/pages/SkillIntelligence";
import { DIRECTORY_PATHS } from "@cd/routes";
import "./directory.css";

export const directoryQueryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, retry: 1, refetchOnWindowFocus: false },
  },
});

/** Everything rendered here gets the directory's scoped tokens and Tailwind utilities (".cd-root"). */
const DirectoryScope = () => (
  <div className="cd-root" data-testid="company-directory">
    <Outlet />
  </div>
);

/**
 * Company Directory routes, mounted by the host at "company-directory/*".
 * Uses the host's single BrowserRouter (descendant <Routes>, relative paths); it creates no router of its own.
 */
export default function CompanyDirectoryRoutes({ notFound }: { notFound: ReactNode }) {
  return (
    <QueryClientProvider client={directoryQueryClient}>
      <CompanyProvider>
        <Routes>
          <Route element={<DirectoryScope />}>
            <Route index element={<DirectoryHome />} />
            <Route path="company" element={<CompanyLayout />}>
              <Route index element={<Navigate to={DIRECTORY_PATHS.intelligence} replace />} />
              <Route path="intelligence" element={<CompanyIntelligence />} />
              <Route path="skills" element={<SkillIntelligence />} />
            </Route>
          </Route>
          {/* Host NotFound stays outside .cd-root so host components keep host styling. */}
          <Route path="*" element={notFound} />
        </Routes>
      </CompanyProvider>
    </QueryClientProvider>
  );
}
