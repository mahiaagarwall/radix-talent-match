import { Routes, Route } from 'react-router-dom';
import { AppDataProvider } from './context/AppDataContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppShell } from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import CompanyDirectory from './pages/CompanyDirectory';
import ResumeParsing from './pages/ResumeParsing';
import ProfileBuilder from './pages/ProfileBuilder';
import JDAnalytics from './pages/JDAnalytics';
import TalentCheck from './pages/TalentCheck';
import SkillMatching from './pages/SkillMatching';
import JobFinder from './pages/JobFinder';
import ResumeCoach from './pages/ResumeCoach';
import Results from './pages/Results';
import ResultDetail from './pages/ResultDetail';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="company-directory/*" element={<CompanyDirectory />} />
        <Route path="resume-parsing" element={<ResumeParsing />} />
        <Route path="profile-builder" element={<ProfileBuilder />} />
        <Route path="profile-builder/:profileId" element={<ProfileBuilder />} />
        <Route path="jd-analytics" element={<JDAnalytics />} />
        <Route path="jd-analytics/:jdId" element={<JDAnalytics />} />
        <Route path="talent-check" element={<TalentCheck />} />
        <Route path="skill-matching" element={<SkillMatching />} />
        <Route path="job-finder" element={<JobFinder />} />
        <Route path="resume-coach" element={<ResumeCoach />} />
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
    <ThemeProvider>
      <ToastProvider>
        <AppDataProvider>{children}</AppDataProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
