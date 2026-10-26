import { useMemo, useState } from 'react';
import { ClipboardList, Gauge, GitCompareArrows, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Segmented } from '../components/ui/Segmented';
import { SearchInput } from '../components/ui/Fields';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { ResultsTable, scoreOf } from '../components/results/ResultsTable';
import { useAppData } from '../context/AppDataContext';

const PAGE_SIZE = 10;

export default function Results() {
  const { results, reloadResults } = useAppData();
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ field: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);

  const counts = {
    all: results.items.length,
    talent_check: results.items.filter((r) => r.type === 'talent_check').length,
    skill_match: results.items.filter((r) => r.type === 'skill_match').length,
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = results.items.filter((r) => {
      if (type !== 'all' && r.type !== type) return false;
      if (!needle) return true;
      return `${r.candidate_name} ${r.profile_id} ${r.company} ${r.role || ''}`.toLowerCase().includes(needle);
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.field === 'score') return (scoreOf(a) - scoreOf(b)) * dir;
      if (sort.field === 'candidate') return String(a.candidate_name).localeCompare(String(b.candidate_name)) * dir;
      return String(a.created_at).localeCompare(String(b.created_at)) * dir;
    });
  }, [results.items, type, q, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSort = (field) => {
    setSort((s) => (s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: field === 'candidate' ? 'asc' : 'desc' }));
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Results"
        description="Every Talent Check and Skill Matching run. Readiness and job-match scores answer different questions, so they are listed side by side — never averaged together."
        actions={
          <>
            <Button icon={Gauge} to="/talent-check">
              New Talent Check
            </Button>
            <Button variant="primary" icon={GitCompareArrows} to="/skill-matching">
              New Skill Match
            </Button>
          </>
        }
      />
      <Card>
        <CardHeader icon={ClipboardList} title="Assessment history" subtitle={`${filtered.length} of ${results.items.length} results`} />
        <div className="table-toolbar">
          <Segmented
            label="Filter by assessment type"
            value={type}
            onChange={(v) => {
              setType(v);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'talent_check', label: 'Talent Check', count: counts.talent_check },
              { value: 'skill_match', label: 'Skill Match', count: counts.skill_match },
            ]}
          />
          <SearchInput
            label="Search results"
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Candidate, company or role"
          />
        </div>
        <CardBody flush>
          {results.loading ? (
            <LoadingState label="Loading results…" />
          ) : results.error ? (
            <div style={{ padding: 20 }}>
              <ErrorState error={results.error} title="Could not load results" onRetry={reloadResults} />
            </div>
          ) : results.items.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No assessments yet"
              description="Run a Talent Check or a Skill Match and the result will be listed here with its full breakdown."
              actions={
                <>
                  <Button variant="primary" icon={GitCompareArrows} to="/skill-matching">
                    Run Skill Matching
                  </Button>
                  <Button icon={Gauge} to="/talent-check">
                    Run Talent Check
                  </Button>
                </>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState compact title="No results match these filters" description="Clear the search or choose another assessment type." />
          ) : (
            <ResultsTable rows={rows} sort={sort} onSort={onSort} />
          )}
        </CardBody>
        {pages > 1 && (
          <div className="pager">
            <span className="small muted">
              Page {safePage} of {pages}
            </span>
            <div className="row">
              <Button size="sm" icon={ChevronLeft} disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                Previous
              </Button>
              <Button size="sm" iconRight={ChevronRight} disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
