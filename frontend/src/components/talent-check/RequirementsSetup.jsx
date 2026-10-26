import { useRef, useState } from 'react';
import { FileJson, Upload, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { EmptyState } from '../ui/States';

// Setup state shown when the official company requirements are unavailable.
export function RequirementsSetup({ mode, onImport, onRetry, importing, importError }) {
  const input = useRef(null);
  const [fileName, setFileName] = useState('');
  return (
    <Card>
      <CardHeader icon={FileJson} title="Company requirements needed" subtitle="Talent Check compares a profile with each company's expected level across the 12 RADIX skillsets." />
      <CardBody>
        <EmptyState
          icon={FileJson}
          title="talent_check_company_skillsets.json is not loaded"
          description={
            mode === 'api'
              ? 'The backend did not return company requirements from /api/companies. Load the official file on the FastAPI side, then retry.'
              : 'This file was not included in the hackathon starter ZIP, and RADIX Talent Match will not invent company levels. Ask the facilitator for the official snapshot (participant brief, page 11).'
          }
          actions={
            <>
              {mode === 'demo' && (
                <>
                  <input
                    ref={input}
                    type="file"
                    accept=".json,application/json"
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Import company requirements JSON"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setFileName(f.name);
                        onImport(f);
                      }
                      e.target.value = '';
                    }}
                  />
                  <Button variant="primary" icon={Upload} loading={importing} onClick={() => input.current?.click()}>
                    Import official JSON
                  </Button>
                </>
              )}
              <Button icon={RefreshCw} onClick={onRetry}>
                Retry loading
              </Button>
            </>
          }
        />
        {importError && (
          <Alert tone="error" title={`Could not import ${fileName || 'the file'}`}>
            {importError}
          </Alert>
        )}
        <div className="setup-steps">
          <p className="label-caps">To enable Talent Check</p>
          <ol>
            <li>
              Obtain <span className="mono">talent_check_company_skillsets.json</span> from the facilitator (three in-scope companies).
            </li>
            <li>
              Commit it to <span className="mono">data/</span> and copy it to <span className="mono">frontend/public/data/</span> — it then loads automatically — or
              import it above (stored in this browser only).
            </li>
            <li>
              Accepted shapes and the 1–10 level scale are documented in <span className="mono">docs/api-contract.md</span>.
            </li>
          </ol>
        </div>
      </CardBody>
    </Card>
  );
}
