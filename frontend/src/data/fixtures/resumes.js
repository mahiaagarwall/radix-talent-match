// DEMO FIXTURES — hand-annotated from the four sample resumes supplied in
// "Talent Match Hackathon.zip" (Resumes/Word/*.docx). These are NOT parser output.
// They let the UI be demonstrated before the FastAPI resume parser exists.
//
// Annotation rules (see docs/scoring-rules.md):
//   evidence   — a verbatim (or lightly trimmed) quote from the resume
//   confidence — extraction confidence, not proficiency:
//     high   = listed under Technical Skills AND corroborated by a project,
//              internship or achievement
//     medium = listed only, or demonstrated in a project without being listed
//     low    = indirect or inferred signal
//   No resume contains an email address, so email is null in every fixture.

const EDU = (field, grade) => [
  { degree: 'B.Tech', field, institution: '', graduation_year: '2026', grade },
];

export const RESUME_FIXTURES = [
  {
    key: 'ananya-rao',
    source_files: ['Ananya Rao.pdf', 'Ananya Rao.docx'],
    parsed: {
      source_type: 'resume',
      name: 'Ananya Rao',
      email: null,
      headline: 'Systems-leaning generalist — strong fit for SWE-heavy roles, weaker fit for data roles',
      education: EDU('Computer Science and Engineering', 'CGPA 8.6 / 10'),
      skills: [
        { skill_name: 'C++', category_code: 'COD', evidence: 'Implemented a multithreaded job scheduler in C++', confidence: 'high' },
        { skill_name: 'Java', category_code: 'COD', evidence: 'Designed a parking-lot management system in Java', confidence: 'high' },
        { skill_name: 'Python', category_code: 'COD', evidence: 'Listed under Technical Skills', confidence: 'medium' },
        { skill_name: 'Data Structures & Algorithms', category_code: 'DSA', evidence: 'Solved 350+ problems on competitive programming platforms; mentors juniors on DSA', confidence: 'high' },
        { skill_name: 'Operating Systems', category_code: 'OS', evidence: 'Multithreaded job scheduler simulating OS-level process scheduling algorithms (Round Robin, Priority, SJF)', confidence: 'high' },
        { skill_name: 'Linux', category_code: 'OS', evidence: 'Listed under Technical Skills', confidence: 'medium' },
        { skill_name: 'Computer Networks', category_code: 'NETW', evidence: 'Listed under Technical Skills', confidence: 'medium' },
        { skill_name: 'Object-Oriented Design', category_code: 'OOD', evidence: 'Parking-lot management system in Java using OOP design patterns (Factory, Strategy)', confidence: 'high' },
        { skill_name: 'System Design', category_code: 'SYSD', evidence: 'Built a distributed URL-shortening service with a Redis-backed cache and a horizontally-scalable API layer', confidence: 'medium' },
        { skill_name: 'Software Engineering Practices', category_code: 'SWE', evidence: 'Backend intern — shipped a rate-limiter used in production', confidence: 'medium' },
        { skill_name: 'Git', category_code: 'SWE', evidence: 'Listed under Technical Skills', confidence: 'medium' },
        { skill_name: 'Communication', category_code: 'COMM', evidence: 'Mentors juniors on DSA through the college coding club (indirect signal)', confidence: 'low' },
      ],
      projects: [
        { title: 'Distributed URL shortener', description: 'Built a distributed URL-shortening service with a Redis-backed cache and a horizontally-scalable API layer as a capstone systems project' },
        { title: 'Multithreaded job scheduler', description: 'Implemented a multithreaded job scheduler in C++ simulating OS-level process scheduling algorithms (Round Robin, Priority, SJF)' },
        { title: 'Parking-lot management system', description: 'Designed a parking-lot management system in Java using OOP design patterns (Factory, Strategy) as a design-practice exercise' },
      ],
      internships: [
        { role: 'Summer intern, backend team', organization: 'Mid-size product startup', description: 'Shipped a rate-limiter used in production' },
      ],
      hackathons: [
        { name: 'National-level 24-hour hackathon', result: 'Finalist', description: 'Built a real-time chat backend' },
      ],
      certifications: [],
      achievements: ['Solved 350+ problems on competitive programming platforms; mentors juniors on DSA through the college coding club'],
      preferred_roles: ['Software Engineer', 'Backend Engineer'],
    },
  },
  {
    key: 'karthik-subramaniam',
    source_files: ['Karthik Subramaniam.pdf', 'Karthik Subramaniam.docx'],
    parsed: {
      source_type: 'resume',
      name: 'Karthik Subramaniam',
      email: null,
      headline: 'Data-leaning analyst — strong fit for Data Scientist / Data Analyst roles, weaker fit for pure SWE roles',
      education: EDU('Computer Science and Engineering', 'CGPA 8.2 / 10'),
      skills: [
        { skill_name: 'SQL', category_code: 'SQL', evidence: 'End-to-end churn-prediction pipeline (SQL extraction → feature engineering → logistic regression model)', confidence: 'high' },
        { skill_name: 'Database Schema Design', category_code: 'SQL', evidence: 'Designed a normalized schema and dashboard for a college event-management system', confidence: 'medium' },
        { skill_name: 'Python', category_code: 'COD', evidence: 'Python (pandas, scikit-learn); churn-prediction pipeline', confidence: 'high' },
        { skill_name: 'Java (basic)', category_code: 'COD', evidence: 'Listed as "basic Java" under Technical Skills', confidence: 'medium' },
        { skill_name: 'Machine Learning', category_code: 'AI', evidence: 'scikit-learn listed; built a logistic regression churn model', confidence: 'high' },
        { skill_name: 'Statistics', category_code: 'APTI', evidence: 'Listed under Technical Skills', confidence: 'medium' },
        { skill_name: 'A/B Testing (basics)', category_code: 'APTI', evidence: 'Ran and analyzed an A/B test simulation comparing two onboarding flows', confidence: 'high' },
        { skill_name: 'Power BI', category_code: 'OTHER', evidence: 'Data Analytics intern — built two recurring dashboards used by the growth team; runner-up, inter-college data visualization competition', confidence: 'high' },
        { skill_name: 'Excel', category_code: 'OTHER', evidence: 'Listed under Technical Skills', confidence: 'medium' },
        { skill_name: 'Data Analysis', category_code: 'OTHER', evidence: 'Published a short analysis write-up on a public dataset', confidence: 'high' },
        { skill_name: 'Anomaly Detection', category_code: 'OTHER', evidence: 'Anomaly detection on registration spikes (event-management project)', confidence: 'medium' },
        { skill_name: 'Communication', category_code: 'COMM', evidence: 'Presented A/B test results to a non-technical audience', confidence: 'medium' },
      ],
      projects: [
        { title: 'Churn-prediction pipeline', description: 'Built an end-to-end churn-prediction pipeline (SQL extraction → feature engineering → logistic regression model) on a public e-commerce dataset' },
        { title: 'Event-management schema and dashboard', description: 'Designed a normalized schema and dashboard for a college event-management system, including anomaly detection on registration spikes' },
        { title: 'A/B test simulation', description: 'Ran and analyzed an A/B test simulation comparing two onboarding flows, presenting results to a non-technical audience' },
      ],
      internships: [
        { role: 'Data Analytics intern', organization: 'Fintech startup', description: 'Built two recurring dashboards used by the growth team' },
      ],
      hackathons: [
        { name: 'Inter-college data visualization competition', result: 'Runner-up', description: '' },
      ],
      certifications: [{ name: 'Google Data Analytics Certificate', issuer: 'Google' }],
      achievements: ['Published a short analysis write-up on a public dataset, featured in a college newsletter'],
      preferred_roles: ['Data Analyst', 'Data Scientist'],
    },
  },
  {
    key: 'priya-menon',
    source_files: ['Priya Menon.pdf', 'Priya Menon.docx'],
    parsed: {
      source_type: 'resume',
      name: 'Priya Menon',
      email: null,
      headline: 'Entry-level, support-oriented — best fit for the Oracle FSS roles, weaker fit for Google / Microsoft',
      education: EDU('Information Technology', 'CGPA 7.4 / 10'),
      skills: [
        { skill_name: 'SQL (basic)', category_code: 'SQL', evidence: 'SQL (basic) listed; student attendance tracker with a MySQL backend', confidence: 'high' },
        { skill_name: 'Java', category_code: 'COD', evidence: 'Built a simple student attendance tracker using Java', confidence: 'high' },
        { skill_name: 'Linux (basics)', category_code: 'OS', evidence: 'Listed as "Linux basics" under Technical Skills', confidence: 'medium' },
        { skill_name: 'Networking (fundamentals)', category_code: 'NETW', evidence: 'Networking fundamentals listed; Cisco Networking Basics (online course)', confidence: 'high' },
        { skill_name: 'Excel', category_code: 'OTHER', evidence: 'MS Excel listed under Technical Skills', confidence: 'medium' },
        { skill_name: 'Technical Troubleshooting', category_code: 'OTHER', evidence: 'IT support desk intern — handled first-level troubleshooting and escalations', confidence: 'high' },
        { skill_name: 'Ticketing / Incident Tools', category_code: 'OTHER', evidence: '"Exposure to ticketing tools"; helpdesk simulation project logging resolutions', confidence: 'low' },
        { skill_name: 'Communication', category_code: 'COMM', evidence: 'Volunteer coordinator for a college technical fest, coordinating logistics across teams', confidence: 'medium' },
      ],
      projects: [
        { title: 'Student attendance tracker', description: 'Built a simple student attendance tracker using Java and a MySQL backend for a college project' },
        { title: 'Helpdesk simulation', description: 'Contributed to a college helpdesk simulation project, resolving simulated tickets and logging resolutions' },
      ],
      internships: [
        { role: 'Summer intern, IT support desk', organization: 'Local business', description: 'Handled first-level troubleshooting and escalations' },
      ],
      hackathons: [
        { name: '12-hour campus hackathon', result: 'Participant (non-finalist)', description: '' },
      ],
      certifications: [{ name: 'Cisco Networking Basics (online course)', issuer: 'Cisco' }],
      achievements: ['Volunteer coordinator for a college technical fest, coordinating logistics across teams'],
      preferred_roles: ['Application Support Analyst', 'Associate Software Engineer'],
    },
  },
  {
    key: 'rohan-verma',
    source_files: ['Rohan Verma.pdf', 'Rohan Verma.docx'],
    parsed: {
      source_type: 'resume',
      name: 'Rohan Verma',
      email: null,
      headline: 'Strong all-rounder — competitive fit across nearly every role in this pack',
      education: EDU('Computer Science and Engineering', 'CGPA 9.1 / 10'),
      skills: [
        { skill_name: 'C++', category_code: 'COD', evidence: 'Listed under Technical Skills', confidence: 'medium' },
        { skill_name: 'Python', category_code: 'COD', evidence: 'Open-source contributor (2 merged PRs to a mid-size Python library)', confidence: 'high' },
        { skill_name: 'SQL', category_code: 'SQL', evidence: 'Listed under Technical Skills', confidence: 'medium' },
        { skill_name: 'Data Structures & Algorithms', category_code: 'DSA', evidence: '500+ problems solved across competitive programming platforms', confidence: 'high' },
        { skill_name: 'System Design', category_code: 'SYSD', evidence: 'Scalable notification service (pub-sub architecture, horizontally-scalable workers), documented with architecture diagrams', confidence: 'high' },
        { skill_name: 'Object-Oriented Design', category_code: 'OOD', evidence: 'Wrote a technical blog series on object-oriented design patterns used in real-world systems', confidence: 'high' },
        { skill_name: 'Operating Systems', category_code: 'OS', evidence: 'Listed under Technical Skills', confidence: 'medium' },
        { skill_name: 'Machine Learning (basic)', category_code: 'AI', evidence: 'Recommendation engine using collaborative filtering, evaluated with precision/recall', confidence: 'high' },
        { skill_name: 'Software Engineering Practices', category_code: 'SWE', evidence: 'SWE intern — shipped a feature end-to-end including tests and CI', confidence: 'high' },
        { skill_name: 'Git', category_code: 'SWE', evidence: 'Listed under Technical Skills', confidence: 'medium' },
        { skill_name: 'Docker', category_code: 'CLOUD', evidence: 'Listed under Technical Skills', confidence: 'medium' },
        { skill_name: 'Open-source Contribution', category_code: 'OTHER', evidence: '2 merged PRs to a mid-size Python library', confidence: 'high' },
        { skill_name: 'Communication', category_code: 'COMM', evidence: 'Technical blog series; system-design project documented with architecture diagrams', confidence: 'medium' },
      ],
      projects: [
        { title: 'Scalable notification service', description: 'Designed and built a scalable notification service (pub-sub architecture, horizontally-scalable workers) as a personal system-design project, documented with architecture diagrams' },
        { title: 'Movie recommendation engine', description: 'Built a recommendation engine using collaborative filtering on a movie-ratings dataset, evaluated with precision/recall' },
        { title: 'OOD patterns blog series', description: 'Wrote a technical blog series on object-oriented design patterns used in real-world systems' },
      ],
      internships: [
        { role: 'Software Engineering intern', organization: 'Series-B startup', description: 'Shipped a feature end-to-end including tests and CI' },
      ],
      hackathons: [
        { name: 'National inter-college hackathon', result: 'Winner', description: 'Built a real-time collaborative document editor' },
      ],
      certifications: [],
      achievements: ['500+ problems solved across competitive programming platforms; open-source contributor (2 merged PRs to a mid-size Python library)'],
      preferred_roles: ['Software Engineer', 'Data Scientist', 'Backend Engineer'],
    },
  },
];
