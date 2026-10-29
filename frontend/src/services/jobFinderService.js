import { ENDPOINTS } from '../app/config';
import { apiClient, ApiError } from './apiClient';
import { getDataMode } from './mode';
import { tick } from './localRepository';
import { profileService } from './profileService';
import { jdService } from './jdService';
import { rankCompanies, DEFAULT_TOP_N } from '../utils/companyMatcher';

// Skill synonyms for client-side fallback matching
const SYNONYMS = {
  python: ['python', 'py', 'python3'],
  java: ['java', 'core java'],
  'c++': ['c++', 'cpp', 'c/c++'],
  dsa: ['data structures & algorithms', 'dsa', 'data structures', 'algorithms'],
  ml: ['machine learning', 'ml', 'ai', 'deep learning'],
  sql: ['sql', 'postgresql', 'mysql', 'postgres', 'database'],
  system_design: ['system design', 'distributed systems', 'scalability'],
  git: ['git', 'version control', 'github', 'gitlab'],
  cloud: ['cloud', 'aws', 'azure', 'gcp', 'docker', 'kubernetes'],
};

function normalizeSkill(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\w+#]/g, ' ')
    .trim();
}

function skillMatches(cand, target) {
  const c = normalizeSkill(cand);
  const t = normalizeSkill(target);
  if (!c || !t) return false;
  if (c === t || c.includes(t) || t.includes(c)) return true;
  for (const group of Object.values(SYNONYMS)) {
    const inCand = group.some((g) => c.includes(g));
    const inTarget = group.some((g) => t.includes(g));
    if (inCand && inTarget) return true;
  }
  return false;
}

function localRecommend(profile, jds, roleFilter = '', minScore = 0, limit = 15) {
  const candSkills = (profile.skills || []).map((s) => (typeof s === 'string' ? s : s.skill_name || s.name || ''));
  const candName = profile.name || 'Candidate';
  const candRoles = (profile.preferred_roles || []).map((r) => String(r).toLowerCase());

  const recommendations = [];

  for (const jd of jds) {
    const role = jd.role || 'Role';
    const company = jd.company || 'Company';
    const roleCategory = jd.role_category || '';

    if (roleFilter) {
      const rf = roleFilter.toLowerCase().trim();
      if (!role.toLowerCase().includes(rf) && !company.toLowerCase().includes(rf) && !roleCategory.toLowerCase().includes(rf)) {
        continue;
      }
    }

    const jdSkills = jd.skills || [];
    const required = [];
    const preferred = [];

    jdSkills.forEach((s) => {
      const name = typeof s === 'string' ? s : s.skill_name || s.name || '';
      const req = (typeof s === 'object' ? s.requirement || s.type || 'required' : 'required').toLowerCase();
      if (name) {
        if (req.includes('pref') || req.includes('bonus')) preferred.push(name);
        else required.push(name);
      }
    });

    if (required.length === 0 && preferred.length > 0) {
      required.push(...preferred);
      preferred.length = 0;
    }
    if (required.length === 0) {
      required.push('Programming', 'Problem Solving');
    }

    // Required match
    const reqMatched = [];
    const reqMissing = [];
    for (const t of required) {
      if (candSkills.some((c) => skillMatches(c, t))) reqMatched.push(t);
      else reqMissing.push(t);
    }
    const reqPct = required.length ? Math.round((reqMatched.length / required.length) * 100) : 100;

    // Preferred match
    const prefMatched = [];
    const prefMissing = [];
    for (const t of preferred) {
      if (candSkills.some((c) => skillMatches(c, t))) prefMatched.push(t);
      else prefMissing.push(t);
    }
    const prefPct = preferred.length ? Math.round((prefMatched.length / preferred.length) * 100) : 100;

    // Category / role relevance
    let catScore = 50;
    if (candRoles.some((r) => role.toLowerCase().includes(r) || (roleCategory && roleCategory.toLowerCase().includes(r)))) {
      catScore += 35;
    }
    const categoryRelevance = Math.min(100, catScore);

    // Experience relevance
    let expScore = 50;
    if ((profile.projects || []).length > 0) expScore += 25;
    if ((profile.internships || []).length > 0) expScore += 25;
    const experienceRelevance = Math.min(100, expScore);

    // Multi-factor weighted score
    const overallScore = Math.round(
      reqPct * 0.50 + prefPct * 0.20 + categoryRelevance * 0.15 + experienceRelevance * 0.15,
    );

    if (overallScore < minScore) continue;

    let matchTier = 'Growth Opportunity';
    if (overallScore >= 75) matchTier = 'Strong Match';
    else if (overallScore >= 55) matchTier = 'Good Match';
    else if (overallScore >= 35) matchTier = 'Moderate Match';

    const allMatched = [...reqMatched, ...prefMatched];
    let rationale = '';
    if (reqPct >= 80) {
      rationale = `High technical overlap (${reqMatched.length}/${required.length} required skills matched). Strong foundational capability for ${role} at ${company}.`;
    } else if (reqPct >= 50) {
      rationale = `Solid core foundation with ${reqMatched.length} matched competencies. Addressing gaps in ${reqMissing.slice(0, 2).join(', ')} will elevate competitiveness.`;
    } else {
      rationale = `Emerging fit (${reqPct}% required skills verified). Key competencies like ${reqMissing.slice(0, 2).join(', ')} are currently unverified.`;
    }

    const limitations = [
      'Score calculated from candidate profile evidence and parsed credentials.',
      'Requires technical interview validation of practical systems depth.',
    ];
    if (reqMissing.length > 0) {
      limitations.push(`Skill gaps identified in required areas: ${reqMissing.slice(0, 3).join(', ')}.`);
    }

    recommendations.push({
      jd_id: jd.jd_id,
      company,
      role,
      role_category: roleCategory,
      location: jd.location || 'Remote / Hybrid',
      employment_type: jd.employment_type || 'Full-Time',
      overall_score: overallScore,
      match_tier: matchTier,
      breakdown: {
        required_skills_match: reqPct,
        preferred_skills_match: prefPct,
        category_relevance: categoryRelevance,
        experience_relevance: experienceRelevance,
      },
      matching_skills: allMatched,
      missing_required_skills: reqMissing,
      missing_preferred_skills: prefMissing,
      rationale,
      limitations,
    });
  }

  recommendations.sort((a, b) => b.overall_score - a.overall_score);
  const sliced = recommendations.slice(0, limit);

  return {
    candidate_name: candName,
    total_jobs_evaluated: jds.length,
    matches: sliced,
    evaluation_summary: sliced.length
      ? `Evaluated ${jds.length} roles for ${candName}. Found ${sliced.length} recommendations (top match: ${sliced[0].overall_score}% at ${sliced[0].company}).`
      : `Evaluated ${jds.length} roles. No positions met the minimum score threshold.`,
  };
}

// Company Directory data is the same for every candidate; reuse it for 5 minutes
// (the directory's own staleTime) instead of re-reading every table per click.
const DIRECTORY_CACHE_MS = 5 * 60 * 1000;
let directoryCache = null;

function loadDirectory() {
  if (directoryCache && Date.now() - directoryCache.at < DIRECTORY_CACHE_MS) return directoryCache.promise;
  // Loaded on demand, like the lazily-routed directory, to keep Supabase out of the main bundle.
  const promise = import('@cd/lib/companyApi').then((api) => api.fetchAllCompanyIntelligence());
  directoryCache = { at: Date.now(), promise };
  promise.catch(() => {
    if (directoryCache?.promise === promise) directoryCache = null; // never cache a failure
  });
  return promise;
}

export const jobFinderService = {
  /**
   * Ranks every Company Directory company against one saved profile and returns the
   * top five. The directory is read from its own Supabase tables in both data modes.
   */
  async recommendCompanies({ profileId, topN = DEFAULT_TOP_N }) {
    if (!profileId) throw new ApiError('Select a candidate profile.', { code: 'validation' });
    const [profile, directory, jds] = await Promise.all([profileService.get(profileId), loadDirectory(), jdService.list()]);
    if (directory.companies.length === 0) {
      throw new ApiError('The Company Directory returned no companies, so there is nothing to rank.', { code: 'empty' });
    }
    return { ...rankCompanies(profile, directory.companies, { jds, topN }), warnings: directory.warnings };
  },

  clearDirectoryCache() {
    directoryCache = null;
  },

  async recommend({ profileId, candidateProfile, roleFilter = '', minScore = 0, limit = 15 }) {
    if (getDataMode() === 'api') {
      try {
        const body = await apiClient.post(ENDPOINTS.careerCopilotJobs, {
          profile_id: profileId,
          candidate_profile: candidateProfile,
          role_filter: roleFilter || undefined,
          min_score: minScore,
          limit,
        });
        return body;
      } catch (err) {
        // Fall back to local evaluation if server error or offline
        console.warn('API recommend failed, using local fallback:', err);
      }
    }

    // Local evaluation
    await tick(300);
    let profile = candidateProfile;
    if (!profile && profileId) {
      profile = await profileService.get(profileId);
    }
    if (!profile) {
      profile = { name: 'Candidate', skills: ['Python', 'SQL', 'Data Structures & Algorithms'] };
    }

    const jds = await jdService.list();
    return localRecommend(profile, jds, roleFilter, minScore, limit);
  },

  async listAvailableJobs() {
    if (getDataMode() === 'api') {
      try {
        return await apiClient.get(ENDPOINTS.careerCopilotAvailableJobs);
      } catch (err) {
        console.warn('API listAvailableJobs failed, using local JDs:', err);
      }
    }
    const jds = await jdService.list();
    return jds.map((j) => ({
      jd_id: j.jd_id,
      company: j.company || 'Company',
      role: j.role || 'Role',
      skills: (j.skills || []).map((s) => (typeof s === 'string' ? s : s.skill_name || s.name || '')),
    }));
  },
};
