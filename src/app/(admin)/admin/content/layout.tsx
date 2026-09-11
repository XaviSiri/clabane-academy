// Scopes the "Clabane Coral" / "Fresh Mint" admin-dashboard design system
// (see .admin-theme in src/app/globals.css) to this route and its
// sub-routes only, leaving the shared nav bar (rendered by the parent
// (admin)/layout.tsx) on the nero/water-leaf/verdun-green brand identity.
import { ContentPageHeader } from "./_components/ContentPageHeader";

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-theme">
      <ContentPageHeader title="Content" subtitle="Manage modules, lessons, and assessments" />
      {children}
    </div>
  );
}
