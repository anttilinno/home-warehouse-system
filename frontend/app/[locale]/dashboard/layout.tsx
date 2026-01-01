import { Sidebar } from "@/components/dashboard/sidebar";
import { InstallPrompt } from "@/components/pwa";
import { ScanButton } from "@/components/scanner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 pr-8">
          {children}
        </div>
      </main>
      <InstallPrompt />
      <ScanButton />
    </div>
  );
}