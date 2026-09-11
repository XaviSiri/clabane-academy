import { existsSync } from "fs";
import path from "path";

// Server component — deliberately separate from the shared ClabaneLogo
// component (which lives on the dark nav-bar gradient and must not get a
// coral halo); this is a /admin/content-only page header. The logo file
// existence check runs at render time on the server (fs.existsSync), which
// is how this stays a server component: a client-side onError fallback
// (like ClabaneLogo.tsx uses) needs "use client", which this doesn't.
const LOGO_PUBLIC_PATH = "/assets/clabane-logo.png";
const logoExists = existsSync(path.join(process.cwd(), "public", LOGO_PUBLIC_PATH));

export function ContentPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="content-page-header">
      <div className="logo-container">
        {logoExists ? (
          // eslint-disable-next-line @next/next/no-img-element -- fixed local asset, matches the path already used by NavBar/ClabaneLogo
          <img src={LOGO_PUBLIC_PATH} alt="Clabane" className="logo-image" />
        ) : (
          "Clabane"
        )}
      </div>
      <div className="content-page-header__title">
        <h1>{title}</h1>
        {subtitle && <p className="content-page-header__subtitle">{subtitle}</p>}
      </div>
    </header>
  );
}
