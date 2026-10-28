import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ErrorState, LoadingState } from '../components/ui/States';
import { MatchResultView } from '../components/skill-matching/MatchResultView';
import { TalentCheckResultView } from '../components/talent-check/TalentCheckResultView';
import { resultsService } from '../services/resultsService';

export default function ResultDetail() {
  const { resultId } = useParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError(null);
    if (!resultId || resultId === 'undefined') {
      setError(new Error('Invalid or missing result ID.'));
      return;
    }
    resultsService
      .get(resultId)
      .then((r) => !cancelled && setResult(r))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [resultId, attempt]);

  const isTalent = result?.type === 'talent_check';
  const rerunTo = result
    ? isTalent
      ? `/talent-check?profile=${result.profile_id}&company=${encodeURIComponent(result.company_id)}`
      : `/skill-matching?profile=${result.profile_id}&jd=${result.jd_id}`
    : null;

  return (
    <>
      <PageHeader
        eyebrow={result ? (isTalent ? 'Talent Check result' : 'Skill Matching result') : 'Result'}
        title={result ? `${result.candidate_name} · ${isTalent ? result.company : result.role}` : 'Result details'}
        description={
          result
            ? isTalent
              ? 'Company-level readiness across the 12 RADIX skillsets.'
              : `Job-specific match against ${result.role} at ${result.company}.`
            : undefined
        }
        actions={
          <>
            <Button icon={ArrowLeft} to="/results">
              All results
            </Button>
            {rerunTo && (
              <Button variant="primary" icon={RotateCcw} to={rerunTo}>
                Rerun
              </Button>
            )}
          </>
        }
      />
      {error ? (
        <ErrorState error={error} title="Could not open this result" onRetry={() => setAttempt((a) => a + 1)} />
      ) : !result ? (
        <Card>
          <LoadingState label="Loading result…" />
        </Card>
      ) : isTalent ? (
        <TalentCheckResultView result={result} />
      ) : (
        <MatchResultView result={result} />
      )}
    </>
  );
}
