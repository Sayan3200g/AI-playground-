---
name: Neo-SaaS AI Interface
colors:
  surface: '#0f1321'
  surface-dim: '#0f1321'
  surface-bright: '#353849'
  surface-container-lowest: '#0a0d1c'
  surface-container-low: '#171b2a'
  surface-container: '#1b1f2e'
  surface-container-high: '#262939'
  surface-container-highest: '#303444'
  on-surface: '#dfe1f6'
  on-surface-variant: '#c9c4d7'
  inverse-surface: '#dfe1f6'
  inverse-on-surface: '#2c303f'
  outline: '#928ea0'
  outline-variant: '#474554'
  surface-tint: '#c7bfff'
  primary: '#c7bfff'
  on-primary: '#2b009e'
  primary-container: '#8e7fff'
  on-primary-container: '#25008c'
  inverse-primary: '#5a46d3'
  secondary: '#a0e4ff'
  on-secondary: '#003544'
  secondary-container: '#00cefe'
  on-secondary-container: '#005469'
  tertiary: '#c4c4de'
  on-tertiary: '#2d2f43'
  tertiary-container: '#8e8fa7'
  on-tertiary-container: '#26283c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e4deff'
  primary-fixed-dim: '#c7bfff'
  on-primary-fixed: '#180065'
  on-primary-fixed-variant: '#4228bb'
  secondary-fixed: '#b8eaff'
  secondary-fixed-dim: '#54d5ff'
  on-secondary-fixed: '#001f28'
  on-secondary-fixed-variant: '#004d61'
  tertiary-fixed: '#e0e0fa'
  tertiary-fixed-dim: '#c4c4de'
  on-tertiary-fixed: '#181a2d'
  on-tertiary-fixed-variant: '#44455a'
  background: '#0f1321'
  on-background: '#dfe1f6'
  surface-variant: '#303444'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  body-base:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  sidebar-width: 260px
  max-width-content: 1200px
---

## Brand & Style

The design system is engineered for a high-performance, futuristic AI SaaS environment. It targets developers and power users who value speed, precision, and an immersive "command center" aesthetic.

The visual style is a refined **Cyberpunk-Minimalism**. It draws from the high-fidelity utility of tools like Linear and Raycast but injects a "neon-noir" atmosphere. The experience should feel like operating a sophisticated terminal from the near future: dark, focused, and electrically charged.

**Core Principles:**
- **Luminosity over Mass:** Use glows and light borders rather than heavy fills to define hierarchy.
- **Glassmorphism:** Employ translucent layers and backdrop blurs to create depth without losing the sense of a singular, unified space.
- **Precision:** Every line is thin (1px) and every interaction is snappy, reflecting the speed of the underlying AI.
- **Atmospheric Depth:** Utilize subtle noise textures and radial ambient gradients to prevent the dark interface from feeling "flat" or "dead."

## Colors

The palette is anchored in a deep, cosmic navy-black to provide maximum contrast for neon elements.

- **Backgrounds:** The primary canvas is `#050816`. All secondary surfaces use the `surface_glass` variable to allow background gradients to bleed through.
- **Accents:** Neon Purple (`#7c6af7`) acts as the primary action color, while Accent Cyan (`#00cfff`) is used for secondary data points and success states.
- **Gradients:** Actionable elements should utilize a linear gradient from Purple to Cyan at a 135-degree angle.
- **Overlays:** Apply a subtle 2% opacity grain/noise texture across the entire background to soften the digital gradients.

## Typography

This design system uses a hierarchical font strategy to balance modern tech aesthetics with readability.

- **Headlines (Geist):** Used for titles and prominent headers. It provides a tight, technical feel with its geometric construction.
- **Body (Inter):** The workhorse for all interface text, chat logs, and documentation. It ensures legibility during long sessions.
- **Labels (JetBrains Mono):** Reserved for metadata, code snippets, and small UI indicators (like "TOKENS" or "TEMP"). The monospaced nature reinforces the technical, AI-driven context.

**Scaling:** On mobile devices, `display-lg` should scale down to 32px to maintain viewport integrity.

## Layout & Spacing

The layout is structured around a 12-column fluid grid for the main content area, while the sidebar remains fixed.

- **Rhythm:** A 4px baseline grid governs all internal component spacing. Use 8px, 16px, and 24px increments for most layouts.
- **Sidebar:** Positioned on the left, using the `surface_glass` style with a 1px right-border in a subtle purple-tinted grey.
- **Navigation:** A minimalist top bar (64px height) handles breadcrumbs and global settings, separated by a 1px stroke.
- **Reflow:** On mobile, the sidebar collapses into a bottom drawer or a hidden hamburger menu, and container padding reduces to 16px.

## Elevation & Depth

Depth is conveyed through transparency and "light emission" rather than physical shadows.

1.  **Level 0 (Base):** Background color `#050816` with a faint radial gradient in the top-right corner (`#7c6af7` at 5% opacity).
2.  **Level 1 (Panels):** `surface_glass` (rgba 15, 15, 25, 0.75) with a `backdrop-blur` of 12px.
3.  **Level 2 (Interactive):** Elements like active cards or hovered items gain a 1px solid border of `#7c6af7` and a soft `0px 0px 15px rgba(124, 106, 247, 0.2)` outer glow.
4.  **Level 3 (Popovers/Modals):** Darker semi-opaque fills with higher blur (20px) and a distinct 1px border.

## Shapes

The shape language is "Soft-Tech." It avoids the extreme roundness of consumer apps to maintain a professional, tool-like feel.

- **Standard Radius:** 4px (Soft) for buttons, inputs, and small cards.
- **Container Radius:** 8px for larger panels and modals.
- **Interactive Elements:** Buttons utilize the 4px radius, but the "Send" button may use a slightly larger 6px radius to distinguish it as the primary action.

## Components

### Buttons & Inputs
- **Primary Action (Send):** A vibrant gradient fill (`#7c6af7` to `#00cfff`). On hover, the gradient should shift slightly and the outer glow should intensify.
- **Inputs:** Dark backgrounds with a 1px border (`rgba(255,255,255,0.1)`). On focus, the border transitions to Cyan (`#00cfff`) with a 4px outer glow.
- **Sliders:** The track should be a dark neutral, while the active part of the track and the thumb should be Cyan. Labels for "Temperature" should use the monospaced font.

### Navigation & Lists
- **Sidebar:** Glassmorphic background. Active states for menu items should use a subtle left-hand accent border (2px wide) in Purple.
- **Lists:** Rows should have a subtle hover state that changes the background opacity to 10% white, creating a "lit up" effect.

### Specialized AI UI
- **Chat Bubbles:** AI responses should have a very faint purple glow border to distinguish them from user prompts.
- **Token Counter:** A small badge using the monospaced label style, placed in the corner of the input field.