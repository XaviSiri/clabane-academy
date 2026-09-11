import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Used only for the decorative nav-bar watermark (see layout.tsx).
        display: ["var(--font-display)", ...defaultTheme.fontFamily.serif],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Clabane's official named brand colours. Kept in sync with the
        // CSS custom properties of the same values in src/app/globals.css
        // (--clabane-nero, --clabane-water-leaf, --clabane-verdun-green) —
        // update both places together if these ever change.
        nero: "#0F0900",
        "water-leaf": "#A8E8E2",
        "verdun-green": "#576A02",
        // Admin-dashboard-only design system ("Clabane Coral" / "Fresh
        // Mint"), scoped to .admin-theme in globals.css — see the comment
        // there. Kept in sync with the CSS custom properties of the same
        // values (--bg-primary, --accent-primary, etc.) in globals.css.
        "bg-primary": "#F8FAFB",
        "bg-secondary": "#FFFFFF",
        "bg-tertiary": "#F0F4F8",
        "bg-border": "#E2E8F0",
        "text-primary": "#0F172A",
        "text-secondary": "#475569",
        "text-muted": "#94A3B8",
        "accent-primary": "#FF6B6B",
        "accent-hover": "#FF5252",
        "accent-soft": "#FFE5E5",
        "accent-glow": "rgba(255, 107, 107, 0.25)",
        mint: "#4ECDC4",
        "mint-soft": "#E0F7F5",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",
      },
    },
  },
  plugins: [],
};
export default config;
