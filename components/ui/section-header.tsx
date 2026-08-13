interface SectionHeaderProps {
  id?: string;
  title: string;
  description?: string;
  className?: string;
}

export function SectionHeader({ id, title, description, className = "" }: SectionHeaderProps) {
  return (
    <div className={`mb-4 ${className}`}>
      <h2 id={id} className="section-title">
        {title}
      </h2>
      {description && <p className="mt-1 text-xs text-muted">{description}</p>}
    </div>
  );
}
