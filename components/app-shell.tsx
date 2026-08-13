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
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col lg:ml-0">
        <Header title={title} description={description} />
        <main className="flex-1 p-5 lg:p-7">
          {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
          {children}
        </main>
      </div>
    </div>
  );
}
