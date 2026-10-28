import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "@cd/context/CompanyContext";
import { DIRECTORY_PATHS } from "@cd/routes";

/** Route guard: returns the selected company (restored from localStorage).
 *  If none is selected, sends the visitor to the directory list — never to NotFound. */
export function useSelectedCompany() {
  const { selected } = useCompany();
  const navigate = useNavigate();
  useEffect(() => {
    if (!selected) navigate(DIRECTORY_PATHS.home, { replace: true });
  }, [selected, navigate]);
  return selected;
}
