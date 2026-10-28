import { useEffect } from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · PARALLAX` : 'PARALLAX · Talent Intelligence';
  }, [title]);
}
