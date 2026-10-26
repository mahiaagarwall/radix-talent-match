import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function PageHeader({ eyebrow, title, description, actions, owner }) {
  useDocumentTitle(title);
  return (
    <header className="page-header">
      <div className="page-header__text">
        {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-header__desc">{description}</p>}
        {owner && <p className="xsmall muted" style={{ marginTop: 6 }}>Module owner: {owner}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}
