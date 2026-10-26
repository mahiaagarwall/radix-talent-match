import { Routes, Route } from 'react-router-dom';
import { AppDataProvider } from './context/AppDataContext';
import { ToastProvider } from './context/ToastContext';
import { AppShell } from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import ResumeParsing from './pages/ResumeParsing';
import ProfileBuilder from './pages/ProfileBuilder';
import JDAnalytics from './pages/JDAnalytics';
import TalentCheck from './pages/TalentCheck';
import SkillMatching from './pages/SkillMatching';
import Results from './pages/Results';
import ResultDetail from './pages/ResultDetail';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="resume-parsing" element={<ResumeParsing />} />
        <Route path="profile-builder" element={<ProfileBuilder />} />
        <Route path="profile-builder/:profileId" element={<ProfileBuilder />} />
        <Route path="jd-analytics" element={<JDAnalytics />} />
        <Route path="jd-analytics/:jdId" element={<JDAnalytics />} />
        <Route path="talent-check" element={<TalentCheck />} />
        <Route path="skill-matching" element={<SkillMatching />} />
        <Route path="results" element={<Results />} />
        <Route path="results/:resultId" element={<ResultDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export function AppProviders({ children }) {
  return (
    <ToastProvider>
      <AppDataProvider>{children}</AppDataProvider>
    </ToastProvider>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
