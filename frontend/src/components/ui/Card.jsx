export function Card({ className = '', children, as: Tag = 'section', ...rest }) {
  return (
    <Tag className={`card ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, icon: Icon, actions, plain = false, titleAs: TitleTag = 'h2', id }) {
  return (
    <div className={`card__header${plain ? ' card__header--plain' : ''}`}>
      <div style={{ minWidth: 0 }}>
        <TitleTag className="card__title" id={id}>
          {Icon && <Icon size={17} aria-hidden="true" color="var(--indigo)" />}
          {title}
        </TitleTag>
        {subtitle && <p className="card__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function CardBody({ flush = false, className = '', children }) {
  return <div className={`card__body${flush ? ' card__body--flush' : ''} ${className}`}>{children}</div>;
}

export function CardFooter({ children }) {
  return <div className="card__footer">{children}</div>;
}
