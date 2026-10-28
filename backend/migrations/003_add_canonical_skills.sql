-- ==============================================================================
-- RADIX Talent Match: Migration 003 — Add Canonical Skills to Master Catalog
-- Module: JD Analytics (Krishna Pandey) & Talent Check (Krishna Khanna)
-- Purpose: Expand the canonical skill catalog so application support/operations
--          and software engineering JDs have targeted skills in skill_set_master.
-- Safe to rerun: Each row is inserted only when its skill_set_name is absent.
-- ==============================================================================

-- 1. Application Support and Operations Skills
INSERT INTO public.skill_set_master (skill_set_name, short_name, skill_set_description)
SELECT v.skill_set_name, v.short_name, v.skill_set_description
FROM (VALUES
  ('Application Support', 'APP-SUP', 'Supporting business applications, investigating issues, and restoring service.'),
  ('Incident Management', 'INC', 'Triage, prioritization, tracking, escalation, and resolution of incidents.'),
  ('Troubleshooting', 'TROUBLE', 'Systematic investigation and diagnosis of technical issues.'),
  ('Log Analysis', 'LOG', 'Inspecting application and system logs to diagnose errors and patterns.'),
  ('Ticketing Systems', 'TICKET', 'Using ticketing or incident-management systems to track work.'),
  ('SLA Management', 'SLA', 'Working to service-level targets and communicating risks to deadlines.'),
  ('Batch Processing', 'BATCH', 'Understanding and monitoring scheduled and batch processing jobs.'),
  ('Systems Administration', 'SYSADMIN', 'Operating-system and command-line fundamentals for support tasks.'),
  ('Production Support', 'PROD-SUP', 'Supporting production systems and minimizing service disruption.'),
  ('Database Querying', 'DB-QUERY', 'Using SQL queries to inspect and diagnose application data.'),
  ('Client Support and Communication', 'CLIENT-COMM', 'Explaining incidents, updates, and resolutions to clients.'),
  ('Application Monitoring', 'APP-MON', 'Monitoring logs and application processes to detect issues early.'),
  ('Technical Documentation', 'TECH-DOC', 'Recording incident details, investigations, and resolutions.')
) AS v(skill_set_name, short_name, skill_set_description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.skill_set_master existing
  WHERE lower(trim(existing.skill_set_name)) = lower(trim(v.skill_set_name))
);

-- 2. Software Engineering and Quality Canonical Skills
INSERT INTO public.skill_set_master (skill_set_name, short_name, skill_set_description)
SELECT v.skill_set_name, v.short_name, v.skill_set_description
FROM (VALUES
  ('Software Testing and Quality Assurance', 'TEST-QA', 'Test strategy, test design, automated and manual verification, and quality practices.'),
  ('Security Engineering', 'SEC-ENG', 'Secure software design, threat awareness, and application security practices.'),
  ('Reliability Engineering', 'REL-ENG', 'Designing and operating reliable, resilient, fault-tolerant software systems.'),
  ('API Design and Development', 'API-DEV', 'Designing and implementing APIs, including REST interfaces and request lifecycles.'),
  ('Agile Software Development', 'AGILE', 'Collaborative software delivery through Agile practices, ceremonies, and iterative planning.'),
  ('Performance Engineering', 'PERF-ENG', 'Measuring, analyzing, and improving software performance and efficiency.'),
  ('Version Control and Collaboration', 'VCS-COL', 'Collaborating in shared codebases using reviews and version-control workflows.')
) AS v(skill_set_name, short_name, skill_set_description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.skill_set_master existing
  WHERE lower(trim(existing.skill_set_name)) = lower(trim(v.skill_set_name))
);
