import { Breadcrumbs, type BreadcrumbItem } from "./breadcrumbs";
import { NavIdentity } from "./nav-identity";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { CommandBar } from "./command-bar";

interface AppShellProps {
  title?: string;
  description?: string;
  headerSize?: "default" | "display";
  hideHeader?: boolean;
  breadcrumbs?: BreadcrumbItem[];
  children: React.ReactNode;
}

export function AppShell({
  title,
  description,
  headerSize = "default",
  hideHeader = false,
  breadcrumbs,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col lg:ml-0">
        <div className="flex items-center justify-end gap-3 border-b border-border bg-background/60 px-6 py-2 lg:px-10">
          <CommandBar />
          <NavIdentity />
        </div>
        {!hideHeader && title && (
          <Header title={title} description={description} size={headerSize} />
        )}
        <main className="page-fade flex-1 px-5 py-6 lg:px-10 lg:py-8">
          {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
          {children}
        </main>
      </div>
    </div>
  );
}
