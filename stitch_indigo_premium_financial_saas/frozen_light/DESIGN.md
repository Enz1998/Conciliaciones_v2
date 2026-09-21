---
name: Frozen Light
colors:
  surface: '#f6f9ff'
  surface-dim: '#d4dbe3'
  surface-bright: '#f6f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef4fd'
  surface-container: '#e8eef7'
  surface-container-high: '#e2e9f1'
  surface-container-highest: '#dce3ec'
  on-surface: '#151c22'
  on-surface-variant: '#40484f'
  inverse-surface: '#2a3138'
  inverse-on-surface: '#ebf1fa'
  outline: '#707880'
  outline-variant: '#c0c7d1'
  surface-tint: '#006496'
  primary: '#006496'
  on-primary: '#ffffff'
  primary-container: '#74c0fc'
  on-primary-container: '#004e76'
  inverse-primary: '#91cdff'
  secondary: '#0060aa'
  on-secondary: '#ffffff'
  secondary-container: '#62a9fd'
  on-secondary-container: '#003c6f'
  tertiary: '#486272'
  on-tertiary: '#ffffff'
  tertiary-container: '#a2bdd0'
  on-tertiary-container: '#334d5d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#91cdff'
  on-primary-fixed: '#001e31'
  on-primary-fixed-variant: '#004b72'
  secondary-fixed: '#d3e3ff'
  secondary-fixed-dim: '#a3c9ff'
  on-secondary-fixed: '#001c39'
  on-secondary-fixed-variant: '#004882'
  tertiary-fixed: '#cbe6fa'
  tertiary-fixed-dim: '#afcadd'
  on-tertiary-fixed: '#011e2d'
  on-tertiary-fixed-variant: '#304a5a'
  background: '#f6f9ff'
  on-background: '#151c22'
  surface-variant: '#dce3ec'
typography:
  headline-xl:
    fontFamily: Outfit
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  data-display:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: '0'
  label-sm:
    fontFamily: Outfit
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding: 32px
  gutter: 24px
  section-gap: 80px
---

## Brand & Style
The design system is defined by a "Frozen Light" aesthetic—a sophisticated blend of high-end minimalism and ethereal glassmorphism. It is designed for premium financial or tech interfaces that require a sense of clarity, precision, and calm. 

The visual language utilizes translucent layers, subtle background blurs, and a clinical "ice-cold" palette to evoke an emotional response of trust and effortless efficiency. Whitespace is treated as a structural element rather than a void, ensuring that the interface feels expansive and breathable.

## Colors
The palette is centered around a spectrum of glacial blues and crisp whites. 

- **Primary (Ice Blue):** Used for interactive states and key highlights. It should feel vibrant but cool.
- **Secondary (Deep Arctic):** Reserved for high-contrast text and primary actions to ensure accessibility.
- **Surface:** Uses ultra-light blue tints and pure whites to maintain the "frozen" theme.
- **Glass Accents:** Semi-transparent white overlays (`rgba(255, 255, 255, 0.4)`) are used for container surfaces to create the glassmorphic depth.

## Typography
This design system utilizes **Outfit** for its geometric clarity and premium feel. 

- **Headlines:** All headings use Semi-Bold (600) weights with negative letter-spacing to create a "tight," modern editorial look.
- **Financial Data:** Any numerical data, specifically in tables or dashboards, must utilize the `data-display` style which forces `tabular-nums`. This ensures vertical alignment of decimal points and digits for easier scanning.
- **Hierarchy:** Use generous scale differences between headlines and body text to maintain a minimalist structural hierarchy.

## Layout & Spacing
The layout follows a 12-column fixed grid for desktop (centered, 1200px max-width) and a fluid single-column layout for mobile. 

Spacing is governed by an 8px linear scale. Minimalist aesthetics are maintained by using larger-than-average gaps between sections (`section-gap`) to allow the "Frozen Light" glass elements enough room to breathe without overlapping awkwardly. Padding within glass containers should be generous (minimum 24px) to emphasize the frost effect at the edges.

## Elevation & Depth
Depth is achieved through **Glassmorphism** rather than traditional drop shadows.

1.  **Backdrop Blur:** Floating surfaces (cards, navigation bars) must use a `20px` to `30px` backdrop-filter blur.
2.  **Translucency:** Surfaces use a background of `white` at `40% - 60%` opacity.
3.  **Frost Borders:** Each elevated element requires a `1px` solid border in a very light blue or white at `20%` opacity. This simulates the edge of a pane of ice and ensures the element stands out against bright backgrounds.
4.  **Shadows:** When necessary for functional depth, use a very soft, large-radius shadow (e.g., `blur: 40px, opacity: 4%`) tinted with the primary blue color.

## Shapes
The shape language is "Rounded" (Level 2). This softens the minimalist clinical feel, making the interface feel more approachable and organic, like smoothed ice.

- **Standard Components:** 0.5rem (8px) corner radius.
- **Large Containers/Cards:** 1rem (16px) corner radius.
- **Inputs:** 0.5rem (8px) to match standard components.

## Components
- **Buttons:** Primary buttons use a solid Ice Blue gradient or high-contrast Deep Arctic. Secondary buttons should be glassmorphic with a subtle border and no fill.
- **Input Fields:** Fields are semi-transparent with a 1px border that brightens on focus. Labels should be small, uppercase, and have slight letter-spacing for a technical feel.
- **Cards:** The primary container for content. Must feature the backdrop blur and a soft "frost" border. No heavy drop shadows.
- **Data Tables:** Rows should be separated by faint lines (10% opacity) rather than alternating colors. All numbers must use the `data-display` typography token for perfect alignment.
- **Chips:** Small, pill-shaped elements with a soft blue tint and low-opacity borders, used for categorization or status.