interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <header className="border-b border-border bg-background px-6 py-4 lg:px-8">
      <div className="lg:pl-0 pl-10">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
    </header>
  );
}
