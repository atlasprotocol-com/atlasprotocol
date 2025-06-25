# Atlas Protocol Design System & Styling Guide

## Overview

This document outlines the basic design system and styling guide for the Atlas Protocol landing page. Use this as a reference to rebrand your main application to match the landing page aesthetics.

## Color Scheme

### Brand Colors (CSS Variables)

```css
/* Primary brand colors */
--brand-orange-primary: #ff5c00;
--brand-orange-secondary: #fe7c15;
--brand-orange-light: #ff8c25;
--brand-yellow: #ffc343;
--brand-brown: #d00c00;

/* Neutral colors */
--brand-white: #ffffff;
--brand-off-white: #f8f8f8;
--brand-gray: #9f9f9f;
--brand-dark-gray: #0f0f0f;
--brand-black: #000000;
```

### System Colors (Dark Theme)

```css
--background: #050505;
--foreground: #ffffff;
--card: #111111;
--card-foreground: #ffffff;
--primary: #ff5c00;
--primary-foreground: #ffffff;
--secondary: #1a1a1a;
--secondary-foreground: #ffffff;
--muted: #1a1a1a;
--muted-foreground: #777777;
--accent: #ffc343;
--accent-foreground: #ffffff;
--destructive: #d00c00;
--border: rgba(255, 255, 255, 0.1);
--input: rgba(255, 255, 255, 0.1);
--ring: #fe7c15;
```

## Typography

### Font Families

```css
/* Primary font (body text) */
Inter, sans-serif;

/* Display font (headings) */
Rajdhani, sans-serif;
```

### Font Usage

- **Body text**: Inter (400, 500, 600 weights)
- **Headings**: Rajdhani (300, 400, 500, 600, 700 weights)
- **All headings default to font-weight: 600**

### Typography Classes

```css
h1,
h2,
h3,
h4,
h5,
h6 {
  font-family: var(--font-display);
  font-weight: 600;
}

body {
  font-family: var(--font-sans);
  font-feature-settings:
    "rlig" 1,
    "calt" 1;
}
```

## Design Tokens

### Border Radius

```css
--radius: 0.625rem; /* 10px */
--radius-sm: calc(var(--radius) - 4px); /* 6px */
--radius-md: calc(var(--radius) - 2px); /* 8px */
--radius-lg: var(--radius); /* 10px */
--radius-xl: calc(var(--radius) + 4px); /* 14px */
```

### Spacing

- Uses Tailwind's default spacing scale
- Common patterns: `px-4`, `py-8`, `gap-6`, `mb-6`
- Container max-width: `max-w-7xl`

## Component Patterns

### Buttons

#### Primary Gradient Button

```css
.btn-primary-gradient {
  background: linear-gradient(to right, #ff5c00, #ff8c25);
  color: white;
  font-weight: 600;
  border-radius: 9999px; /* fully rounded */
  transition: opacity 0.2s;
}
.btn-primary-gradient:hover {
  opacity: 0.9;
}
```

#### Primary Outline Button

```css
.btn-primary-outline {
  border: 2px solid #ff5c00;
  color: #ff5c00;
  background: transparent;
  font-weight: 600;
  border-radius: 9999px;
}
.btn-primary-outline:hover {
  background: rgba(255, 92, 0, 0.05);
}
```

### Cards

#### Standard Card

```css
.card {
  background: var(--card);
  border: 1px solid rgba(var(--border), 0.4);
  border-radius: 0.75rem; /* 12px */
  padding: 2rem; /* 32px */
  backdrop-filter: blur(4px);
}
```

#### Feature Card

```css
.feature-card {
  padding: 2rem;
  border-radius: 0.75rem;
  background: var(--card);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(var(--border), 0.4);
  text-align: center;
}
```

## Background Effects & Glow

### Gradient Backgrounds

```css
/* Primary to accent gradient */
background: linear-gradient(to right, var(--primary), var(--accent));

/* Subtle background gradients */
background: linear-gradient(
  to bottom,
  transparent,
  rgba(17, 17, 17, 0.3),
  transparent
);
```

### Glow Effects

```css
/* Orange glow (primary) */
.glow-primary {
  width: 16rem; /* 256px */
  height: 16rem;
  border-radius: 50%;
  background: rgba(255, 92, 0, 0.1);
  filter: blur(120px);
  position: absolute;
  z-index: -10;
}

/* Yellow glow (accent) */
.glow-accent {
  width: 16rem;
  height: 16rem;
  border-radius: 50%;
  background: rgba(255, 195, 67, 0.1);
  filter: blur(120px);
  position: absolute;
  z-index: -10;
}
```

## Animations

### Custom Keyframes

```css
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideInRight {
  from {
    transform: translateX(20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes float {
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
  100% {
    transform: translateY(0px);
  }
}

@keyframes pulsate {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}
```

### Animation Utilities

```css
.animate-fade-in {
  animation: fadeIn 0.5s ease-in-out forwards;
}
.animate-slide-up {
  animation: slideUp 0.7s ease-out forwards;
}
.animate-slide-in-right {
  animation: slideInRight 0.7s ease-out forwards;
}
.animate-scale-in {
  animation: scaleIn 0.5s ease-out forwards;
}
.animate-float {
  animation: float 4s ease-in-out infinite;
}
.animate-pulse-subtle {
  animation: pulsate 2s ease-in-out infinite;
}
```

## Layout Patterns

### Container Pattern

```css
.container {
  margin: 0 auto;
  padding: 0 1rem;
  max-width: 80rem; /* 1280px */
}
```

### Section Pattern

```css
.section {
  padding: 5rem 0; /* py-20 */
  position: relative;
  overflow: hidden;
}

@media (min-width: 768px) {
  .section {
    padding: 8rem 0; /* md:py-32 */
  }
}
```

### Grid Patterns

```css
/* Three column grid */
.grid-3 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .grid-3 {
    grid-template-columns: repeat(3, 1fr);
    gap: 2.5rem;
  }
}
```

## Text Patterns

### Gradient Text

```css
.text-gradient {
  background: linear-gradient(to right, var(--primary), var(--accent));
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}
```

### Opacity Variations

- `text-foreground` - Full opacity
- `text-foreground/70` - 70% opacity (secondary text)
- `text-foreground/60` - 60% opacity (muted text)
- `text-muted-foreground` - Muted color

## Icon Patterns

### Icon Container

```css
.icon-container {
  width: 4rem; /* 64px */
  height: 4rem;
  border-radius: 50%;
  background: rgba(var(--primary), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### SVG Styling

```css
.icon-primary {
  stroke: var(--primary);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
```

## Responsive Design

### Breakpoints (Tailwind)

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

### Common Responsive Patterns

```css
/* Typography scaling */
.heading-responsive {
  font-size: 2.25rem; /* text-4xl */
}

@media (min-width: 768px) {
  .heading-responsive {
    font-size: 3.75rem; /* md:text-6xl */
  }
}

@media (min-width: 1024px) {
  .heading-responsive {
    font-size: 4.5rem; /* lg:text-7xl */
  }
}
```

## Dark Mode Implementation

The site uses a dark theme by default with the `dark` class applied to the `<html>` element:

```html
<html lang="en" className="dark"></html>
```

All components are built with dark mode in mind, using CSS variables that automatically switch between light and dark values.

## Framer Motion Integration

### Common Animation Props

```javascript
// Section animations
{
  animationDirection: 'up' | 'down' | 'left' | 'right',
  animationDuration: 0.5,
  animationDelay: 0.1,
  threshold: 0.1
}

// Element animations
{
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: 0.1 }
}
```

## Dependencies

### Core Styling Libraries

- **Tailwind CSS 4** - Utility-first CSS framework
- **tw-animate-css** - Additional animation utilities
- **Framer Motion** - Animation library
- **Class Variance Authority (CVA)** - Component variant system

### Font Loading

```javascript
import { Inter, Rajdhani } from "next/font/google";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});
```

## Implementation Notes

1. **Always use CSS variables** for colors to ensure theme compatibility
2. **Use semantic color names** (primary, secondary, accent) rather than literal color values
3. **Implement responsive design** using Tailwind's responsive prefixes
4. **Add blur effects** to background elements for depth (`backdrop-blur-sm`)
5. **Use rounded corners** consistently with the design tokens
6. **Apply proper z-indexing** for layered effects (backgrounds at -z-10)
7. **Implement hover states** with smooth transitions
8. **Use gradient effects** sparingly but effectively for CTAs and highlights

## Quick Start Checklist

To apply this design system to your main app:

- [ ] Copy the CSS variables from `globals.css` to your app
- [ ] Install and configure Inter and Rajdhani fonts
- [ ] Set up Tailwind CSS with the same configuration
- [ ] Install Framer Motion for animations
- [ ] Apply the dark theme by default
- [ ] Use the button variants and component patterns
- [ ] Implement the color system throughout your components
- [ ] Add the background glow effects and animations
- [ ] Test responsive design across all breakpoints
