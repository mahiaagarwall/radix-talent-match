// DEMO FIXTURES — hand-annotated from the six sample job descriptions supplied in
// "Talent Match Hackathon.zip" (JDs/Word/*.docx). These are NOT extractor output.
//
// evidence    — verbatim quote from "Key Responsibilities", "What We're Looking
//               For" or "Nice to Have"
// confidence  — extraction confidence (high = explicitly named requirement,
//               medium = implied by responsibilities or a nice-to-have)
// requirement — "required" for responsibilities / "What We're Looking For",
//               "preferred" for "Nice to Have" (a proposed contract extension)

const R = (skill_name, category_code, evidence, confidence = 'high') => ({
  skill_name,
  category_code,
  evidence,
  confidence,
  requirement: 'required',
});
const P = (skill_name, category_code, evidence, confidence = 'medium') => ({
  skill_name,
  category_code,
  evidence,
  confidence,
  requirement: 'preferred',
});

export const JD_FIXTURES = [
  {
    key: 'google-swe',
    source_files: ['Google LLC - Software Engineer.pdf', 'Google LLC - Software Engineer.docx'],
    jd: {
      company: 'Google LLC',
      role: 'Software Engineer (SWE)',
      role_category: 'SDE · Product Engineering',
      location: 'Bengaluru, India (Hybrid)',
      employment_type: 'Full-Time',
      experience_requirements: 'Nice to have: prior internship experience on a large codebase.',
      education_requirements: null,
      skills: [
        R('Data Structures & Algorithms', 'DSA', 'Strong grasp of data structures and algorithms, and the ability to reason about time and space complexity under pressure'),
        R('Programming', 'COD', 'Hands-on programming ability — you can turn a problem statement into working, efficient code quickly'),
        R('Operating Systems', 'OS', 'Working knowledge of operating systems fundamentals (processes, threads, virtual memory)'),
        R('Networking', 'NETW', 'Core networking concepts (TCP/UDP, HTTP, how a web request actually travels)'),
        R('Object-Oriented Design', 'OOD', 'Experience or coursework in object-oriented design and common design patterns'),
        R('System Design', 'SYSD', 'Comfort reasoning about system design at scale — able to sketch how a large distributed system like a URL shortener or a file storage service might be built'),
        R('Software Engineering Practices', 'SWE', 'Solid software engineering fundamentals: testing strategy, code review habits, awareness of technical debt, and basic CI/CD concepts'),
        R('Communication', 'COMM', 'Clear written and verbal communication — able to explain a technical tradeoff to engineers and non-engineers alike'),
        P('Open-source Contribution', 'OTHER', 'Nice to Have: open-source contributions'),
      ],
    },
  },
  {
    key: 'google-ds',
    source_files: ['Google LLC - Data Scientist.pdf', 'Google LLC - Data Scientist.docx'],
    jd: {
      company: 'Google LLC',
      role: 'Data Scientist',
      role_category: 'Data Scientist',
      location: 'Bengaluru, India',
      employment_type: 'Full-Time',
      experience_requirements: 'A track record, academic or applied, of turning a messy dataset into a clear, defensible insight.',
      education_requirements: null,
      skills: [
        R('SQL', 'SQL', 'Strong SQL skills — writing and optimizing complex queries, understanding indexing'),
        R('Database Schema Design', 'SQL', 'Designing a schema for event or telemetry data'),
        R('A/B Testing', 'APTI', 'Design and run experiments (A/B tests) and interpret their results rigorously'),
        R('Quantitative Aptitude', 'APTI', 'Solid quantitative and analytical reasoning — comfortable interpreting experiment results, probability, and metrics under ambiguity'),
        R('Statistics', 'APTI', 'Build and evaluate predictive models, applying sound statistical judgment', 'medium'),
        R('Machine Learning', 'AI', 'Foundational machine learning knowledge: bias-variance tradeoff, regression vs. classification, how gradient descent works'),
        R('Communication', 'COMM', 'Excellent communication skills — able to explain a complex model or a surprising result to a product manager in plain language'),
        R('Data Analysis', 'OTHER', 'A track record, academic or applied, of turning a messy dataset into a clear, defensible insight', 'medium'),
        P('Data Visualization', 'OTHER', 'Nice to Have: experience with a BI/visualization tool'),
      ],
    },
  },
  {
    key: 'microsoft-swe',
    source_files: ['Microsoft - Software Engineer.pdf', 'Microsoft - Software Engineer.docx'],
    jd: {
      company: 'Microsoft Corporation',
      role: 'Software Engineer',
      role_category: 'SDE',
      location: 'Hyderabad, India',
      employment_type: 'Full-Time',
      experience_requirements: null,
      education_requirements: null,
      skills: [
        R('Data Structures & Algorithms', 'DSA', 'Strong data structures and algorithms fundamentals — hash maps, trees, and complexity analysis'),
        R('Programming', 'COD', 'Practical coding skills — pattern matching, interval problems, and writing code that performs well on large inputs'),
        R('Operating Systems', 'OS', 'Working knowledge of operating systems (process scheduling, virtual memory, concurrency primitives)'),
        R('Networking', 'NETW', 'Core networking (REST APIs, timeouts, request lifecycle)'),
        R('System Design', 'SYSD', 'Ability to design at the system level — sketch a cloud-based storage or notification service and reason about scalability and fault tolerance'),
        R('Object-Oriented Design', 'OOD', 'Understanding of object-oriented design and SOLID principles'),
        R('Software Engineering Practices', 'SWE', 'Software engineering maturity — clean code habits, a real testing strategy, and comfort talking about technical debt honestly'),
        R('Communication', 'COMM', 'Strong communication — able to describe a hard problem you solved and how you collaborate across teams'),
        P('Cloud Infrastructure', 'CLOUD', 'Nice to Have: exposure to cloud infrastructure (Azure or similar)'),
      ],
    },
  },
  {
    key: 'microsoft-da',
    source_files: ['Microsoft - Data Analyst.pdf', 'Microsoft - Data Analyst.docx'],
    jd: {
      company: 'Microsoft Corporation',
      role: 'Data Analyst',
      role_category: 'Data Analyst',
      location: 'Hyderabad, India',
      employment_type: 'Full-Time',
      experience_requirements: 'Nice to have: prior internship in an analytics role.',
      education_requirements: null,
      skills: [
        R('SQL', 'SQL', 'Strong, practical SQL — from a simple monthly-active-user query to schema design and index-aware query optimization'),
        R('Database Schema Design', 'SQL', 'Design schemas for telemetry and usage data, and know when to normalize vs. denormalize'),
        R('Quantitative Aptitude', 'APTI', 'Solid quantitative reasoning — interpreting trends, sampling, probability, and reasoning with data tables under ambiguity'),
        R('Machine Learning (basic)', 'AI', 'Basic applied statistics/ML literacy: regression vs. classification, what overfitting means', 'medium'),
        R('Data Visualization', 'OTHER', 'Build dashboards and reporting that stakeholders actually use'),
        R('Anomaly Detection', 'OTHER', 'Detect and explain anomalies in usage or business metrics', 'medium'),
        R('Communication', 'COMM', 'Excellent stakeholder communication — translating a dashboard or an analysis into a decision a non-technical leader can act on'),
      ],
    },
  },
  {
    key: 'oracle-ase',
    source_files: ['Oracle - Associate Software Engineer.pdf', 'Oracle - Associate Software Engineer.docx'],
    jd: {
      company: 'Oracle Financial Services Software Limited',
      role: 'Associate Software Engineer',
      role_category: 'SDE',
      location: 'Bengaluru / Mumbai, India',
      employment_type: 'Full-Time',
      experience_requirements: null,
      education_requirements: null,
      skills: [
        R('Programming', 'COD', 'Solid programming fundamentals — able to read and predict the output of code, and solve basic string/array manipulation problems confidently'),
        R('SQL', 'SQL', 'Practical SQL knowledge — correct SELECT/WHERE syntax, understanding of DELETE vs. TRUNCATE'),
        R('Data Structures & Algorithms', 'DSA', 'Core data structures knowledge — arrays vs. linked lists, when to use a stack or a queue'),
        R('Object-Oriented Design', 'OOD', 'Object-oriented programming fundamentals — inheritance, polymorphism, abstract classes vs. interfaces'),
        R('Operating Systems (basics)', 'OS', 'Operating systems basics — what a process is, fundamentals of multithreading and memory management'),
        R('Quantitative Aptitude', 'APTI', 'Strong quantitative aptitude — time-and-work, ratios, percentages, and logical/seating-arrangement style reasoning'),
        R('Software Engineering Practices', 'SWE', 'Awareness of the software development lifecycle and the difference between Agile and Waterfall; perform unit testing', 'medium'),
        R('Communication', 'COMM', 'Clear communication and a collaborative attitude — comfortable explaining your final-year project'),
        P('Banking / Financial Systems', 'OTHER', 'Nice to Have: coursework or a project in banking/financial systems', 'low'),
      ],
    },
  },
  {
    key: 'oracle-asa',
    source_files: ['Oracle - Application Support Analyst.pdf', 'Oracle - Application Support Analyst.docx'],
    jd: {
      company: 'Oracle Financial Services Software Limited',
      role: 'Application Support Analyst',
      role_category: 'Support / Operations',
      location: 'Bengaluru / Chennai, India',
      employment_type: 'Full-Time',
      experience_requirements: 'Willingness to work in shifts and directly support global clients.',
      education_requirements: null,
      skills: [
        R('SQL (basic)', 'SQL', 'Comfort with basic SQL — simple SELECT/WHERE queries and an understanding of primary keys'),
        R('Linux (fundamentals)', 'OS', 'Operating systems and Linux fundamentals — basic command-line usage, what a log file is, batch vs. real-time processing'),
        R('Networking (basics)', 'NETW', 'Basic networking knowledge — what an IP address is, client-server architecture fundamentals'),
        R('Quantitative Aptitude', 'APTI', 'Strong quantitative and logical reasoning — data interpretation from tables, arithmetic, and structured problem-solving'),
        R('Communication', 'COMM', 'Excellent communication skills — able to explain a technical issue to a non-technical client, stay calm during an escalation'),
        R('Technical Troubleshooting', 'OTHER', 'Triage, investigate, and resolve incidents raised by banking clients within SLA', 'medium'),
        P('Ticketing / Incident Tools', 'OTHER', 'Nice to Have: prior exposure to a ticketing/incident system'),
      ],
    },
  },
];
