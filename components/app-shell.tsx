import { Breadcrumbs, type BreadcrumbItem } from "./breadcrumbs";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

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
        {!hideHeader && title && (
          <Header title={title} description={description} size={headerSize} />
        )}
        <main className="flex-1 px-5 py-6 lg:px-10 lg:py-8">
          {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
          {children}
        </main>
      </div>
    </div>
  );
}
