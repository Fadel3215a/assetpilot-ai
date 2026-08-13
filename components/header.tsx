interface HeaderProps {
  title: string;
  description?: string;
  size?: "default" | "display";
}

export function Header({ title, description, size = "default" }: HeaderProps) {
  return (
    <header className="border-b border-border bg-background px-6 py-6 lg:px-10 lg:py-8">
      <div className="lg:pl-0 pl-10">
        {size === "display" ? (
          <>
            <h1 className="display-title">{title}</h1>
            {description && (
              <p className="editorial-lead mt-3">{description}</p>
            )}
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-foreground lg:text-2xl">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
                {description}
              </p>
            )}
          </>
        )}
      </div>
    </header>
  );
}
