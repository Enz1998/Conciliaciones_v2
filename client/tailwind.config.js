/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Brand & Core ──
        "primary":                    "#0f172a", // Slate 900
        "on-primary":                 "#ffffff",
        "primary-container":          "#f1f5f9",
        "on-primary-container":       "#0f172a",
        "brand":                      "#0f172a",
        "brand-accent":               "#2563eb", // Blue 600

        "secondary":                  "#475569", // Slate 600
        "on-secondary":               "#ffffff",
        "secondary-container":        "#f8fafc",
        "on-secondary-container":     "#1e293b",

        // ── Financial Semantics ──
        "credit":             "#059669", // Emerald 600
        "credit-subtle":      "#ecfdf5", // Emerald 50
        "credit-border":      "#a7f3d0", // Emerald 200
        "debit":              "#475569", // Slate 600
        "debit-subtle":       "#f8fafc",

        // ── Status & Feedback ──
        "error":              "#e11d48", // Rose 600
        "on-error":           "#ffffff",
        "error-container":    "#fff1f2",
        "on-error-container": "#9f1239",
        "error-border":       "#fecdd3",

        "success":              "#059669",
        "on-success":           "#ffffff",
        "success-container":    "#ecfdf5",
        "on-success-container": "#065f46",
        "success-border":       "#a7f3d0",

        "warning":              "#d97706", // Amber 600
        "on-warning":           "#ffffff",
        "warning-container":    "#fffbeb",
        "on-warning-container": "#92400e",
        "warning-border":       "#fde68a",

        "info":                 "#2563eb", // Blue 600
        "on-info":              "#ffffff",
        "info-container":       "#eff6ff",
        "on-info-container":    "#1e40af",
        "info-border":          "#bfdbfe",

        // ── Neutral Surfaces (Slate/Zinc) ──
        "surface":                    "#f8fafc", // Clean Slate 50 background
        "surface-card":               "#ffffff", // Pure white cards
        "surface-muted":              "#f1f5f9", // Slate 100
        "surface-dim":                "#e2e8f0", // Slate 200
        "surface-bright":             "#ffffff",
        "surface-variant":            "#f1f5f9",
        "surface-container-lowest":   "#ffffff",
        "surface-container-low":      "#f8fafc",
        "surface-container":          "#f1f5f9",
        "surface-container-high":     "#e2e8f0",
        "surface-container-highest":  "#cbd5e1",

        "on-surface":         "#0f172a", // Slate 900
        "on-surface-variant": "#475569", // Slate 600
        "on-background":      "#0f172a",
        "background":         "#f8fafc",

        "outline":         "#94a3b8", // Slate 400
        "outline-variant": "#e2e8f0", // Slate 200
        "border-subtle":   "#f1f5f9",

        "inverse-surface":    "#1e293b",
        "inverse-on-surface": "#f8fafc",
        "inverse-primary":    "#94a3b8",
      },

      borderRadius: {
        "DEFAULT": "0.375rem",
        "sm":      "0.25rem",
        "md":      "0.5rem",
        "lg":      "0.75rem",
        "xl":      "1rem",
        "2xl":     "1.25rem",
        "3xl":     "1.5rem",
        "full":    "9999px",
      },

      spacing: {
        "gutter":            "24px",
        "base":              "8px",
        "section-gap":       "64px",
        "container-padding": "28px",
      },

      fontFamily: {
        "sans":  ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        "mono":  ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },

      fontSize: {
        "headline-xl": ["36px", { "lineHeight": "1.15", "letterSpacing": "-0.025em", "fontWeight": "600" }],
        "headline-lg": ["24px", { "lineHeight": "1.25", "letterSpacing": "-0.02em",  "fontWeight": "600" }],
        "headline-md": ["18px", { "lineHeight": "1.3",  "letterSpacing": "-0.015em", "fontWeight": "600" }],
        "body-lg":     ["15px", { "lineHeight": "1.5",  "letterSpacing": "-0.005em", "fontWeight": "400" }],
        "body-md":     ["13px", { "lineHeight": "1.5",  "letterSpacing": "0",        "fontWeight": "400" }],
        "label-sm":    ["11px", { "lineHeight": "1.4",  "letterSpacing": "0.02em",   "fontWeight": "500" }],
        "data-display":["13px", { "lineHeight": "1.3",  "letterSpacing": "-0.01em",  "fontWeight": "500" }],
      },

      keyframes: {
        "skeleton-shimmer": {
          "0%":   { "backgroundPosition": "200% 0" },
          "100%": { "backgroundPosition": "-200% 0" },
        },
        "fade-in": {
          "from": { "opacity": "0" },
          "to":   { "opacity": "1" },
        },
        "slide-up": {
          "from": { "opacity": "0", "transform": "translateY(12px)" },
          "to":   { "opacity": "1", "transform": "translateY(0)" },
        },
        "scale-in": {
          "from": { "opacity": "0", "transform": "scale(0.96)" },
          "to":   { "opacity": "1", "transform": "scale(1)" },
        },
        "toast-in": {
          "from": { "opacity": "0", "transform": "translateX(110%)" },
          "to":   { "opacity": "1", "transform": "translateX(0)" },
        },
        "toast-out": {
          "from": { "opacity": "1", "transform": "translateX(0)" },
          "to":   { "opacity": "0", "transform": "translateX(110%)" },
        },
      },

      animation: {
        "skeleton":  "skeleton-shimmer 1.6s ease-in-out infinite",
        "fade-in":   "fade-in 0.3s ease forwards",
        "slide-up":  "slide-up 0.3s cubic-bezier(0.2, 0, 0, 1) forwards",
        "scale-in":  "scale-in 0.25s cubic-bezier(0.2, 0, 0, 1) forwards",
        "toast-in":  "toast-in 0.3s cubic-bezier(0.2, 0, 0, 1) forwards",
        "toast-out": "toast-out 0.2s ease-in forwards",
      },

      boxShadow: {
        "glass":    "0 2px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        "glass-lg": "0 4px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
        "glass-xl": "0 8px 48px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)",
        "float":    "0 16px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
}
