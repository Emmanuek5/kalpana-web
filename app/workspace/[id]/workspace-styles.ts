/**
 * Workspace Design System with Depth
 * Based on principles from FIX_BORING_UIS.md
 * 
 * Creates visual hierarchy through:
 * - Color layers (darkest to lightest = furthest to closest)
 * - Sophisticated shadow system
 * - Proper elevation for interactive elements
 */

export const workspaceDesign = {
  // Color Layers - From furthest (darkest) to closest (lightest)
  layers: {
    // Layer 0: Deep background (furthest)
    deepBackground: 'bg-[#0a0a0a]',
    
    // Layer 1: Main background
    background: 'bg-[#0f0f0f]',
    
    // Layer 2: Elevated surfaces (cards, panels)
    surface: 'bg-[#1a1a1a]',
    
    // Layer 3: Interactive elements (buttons, inputs)
    interactive: 'bg-[#242424]',
    
    // Layer 4: Highlighted/Active elements (closest)
    elevated: 'bg-[#2d2d2d]',
  },

  // Sophisticated Shadow System
  shadows: {
    // Small elevation - Subtle depth
    sm: `
      shadow-[0_1px_2px_0_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)]
      [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.03)]
    `,
    
    // Medium elevation - Standard cards and panels
    md: `
      shadow-[0_4px_6px_-1px_rgba(0,0,0,0.4),0_2px_4px_-1px_rgba(0,0,0,0.3)]
      [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.05)]
    `,
    
    // Large elevation - Important elements, modals
    lg: `
      shadow-[0_10px_15px_-3px_rgba(0,0,0,0.5),0_4px_6px_-2px_rgba(0,0,0,0.4)]
      [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.07)]
    `,
    
    // Extra large - Floating elements
    xl: `
      shadow-[0_20px_25px_-5px_rgba(0,0,0,0.6),0_10px_10px_-5px_rgba(0,0,0,0.5)]
      [box-shadow:inset_0_2px_0_0_rgba(255,255,255,0.08)]
    `,
    
    // Inset - Recessed elements (inputs, progress tracks)
    inset: `
      shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.4)]
    `,
    
    // Glow - For active/focused states
    glow: (color: string = '16,185,129') => `
      shadow-[0_0_0_1px_rgba(${color},0.3),0_0_20px_rgba(${color},0.15)]
    `,
  },

  // Border System - Subtle separators
  borders: {
    subtle: 'border-white/5',
    default: 'border-white/10',
    strong: 'border-white/20',
    accent: 'border-emerald-500/30',
  },

  // Gradient Overlays for depth
  gradients: {
    // Top-down light gradient for elevated surfaces
    topLight: 'bg-gradient-to-b from-white/[0.03] to-transparent',
    
    // Radial glow for focus areas
    radialGlow: 'bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.1),transparent_50%)]',
    
    // Mesh background for depth
    mesh: `bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem]`,
  },

  // Interactive States
  states: {
    hover: 'hover:brightness-110 hover:shadow-lg transition-all duration-200',
    active: 'active:scale-[0.98] active:brightness-95',
    focus: 'focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-black',
    disabled: 'disabled:opacity-50 disabled:cursor-not-allowed disabled:brightness-75',
  },

  // Component Presets
  components: {
    // Elevated card with proper depth
    card: `
      bg-[#1a1a1a]
      border border-white/10
      rounded-xl
      shadow-[0_4px_6px_-1px_rgba(0,0,0,0.4),0_2px_4px_-1px_rgba(0,0,0,0.3)]
      [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.05)]
      backdrop-blur-sm
    `,
    
    // Interactive button with elevation
    button: `
      bg-[#242424]
      border border-white/10
      rounded-lg
      px-4 py-2
      shadow-[0_1px_2px_0_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)]
      [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.03)]
      hover:bg-[#2d2d2d]
      hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.4)]
      active:scale-[0.98]
      transition-all duration-150
    `,
    
    // Input field (recessed)
    input: `
      bg-[#0f0f0f]
      border border-white/10
      rounded-lg
      px-3 py-2
      shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.4)]
      focus:border-emerald-500/50
      focus:shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.4),0_0_0_3px_rgba(16,185,129,0.1)]
      transition-all duration-150
    `,
    
    // Panel with depth
    panel: `
      bg-[#1a1a1a]
      border-l border-white/10
      shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.3)]
      [box-shadow:inset_1px_0_0_0_rgba(255,255,255,0.03)]
    `,
    
    // Tab with elevation on active
    tab: (isActive: boolean) => isActive 
      ? `
        bg-[#242424]
        text-emerald-400
        border-b-2 border-emerald-500
        shadow-[0_2px_4px_0_rgba(0,0,0,0.3)]
        [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.05)]
      `
      : `
        bg-transparent
        text-zinc-500
        hover:text-zinc-300
        hover:bg-white/5
      `,
  },
};

// Helper function to combine classes
export const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};
