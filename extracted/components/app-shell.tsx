import { Breadcrumbs, type BreadcrumbItem } from "./breadcrumbs";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface AppShellProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  children: React.ReactNode;
}

export function AppShell({ title, description, breadcrumbs, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar />
      <div className="flex flex-1 flex-col lg:ml-0">
        <Header title={title} description={description} />
        <main className="flex-1 p-6 lg:p-8">
          {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
          {children}
        </main>
      </div>
    </div>
  );
}
