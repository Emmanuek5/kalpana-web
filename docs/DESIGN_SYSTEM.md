# Design System - Futuristic Minimalist

## 🎨 Visual Identity

### Philosophy
Clean, focused, professional. Black canvas with emerald accents. Zero distractions.

### Color Palette

```css
/* Primary */
--black: #000000;           /* Pure black background */
--emerald-400: #34d399;     /* Primary accent */

/* Grays */
--zinc-100: #f4f4f5;        /* Primary text */
--zinc-400: #a1a1aa;        /* Secondary text */
--zinc-500: #71717a;        /* Tertiary text */
--zinc-600: #52525b;        /* Muted text */
--zinc-700: #3f3f46;        /* Very muted */
--zinc-800: #27272a;        /* Subtle borders */
--zinc-900: #18181b;        /* Border default */

/* Semantic */
--error: #f87171;           /* red-400 */
--success: #34d399;         /* emerald-400 */
```

### Typography

```css
/* Hierarchy */
.heading-main {
  font-weight: 300;         /* font-light */
  letter-spacing: 0.05em;   /* tracking-wider */
  text-transform: uppercase;
}

.body-text {
  font-weight: 300;         /* font-light */
}

.technical {
  font-family: monospace;
  font-size: 0.75rem;       /* text-xs */
}
```

### Spacing

```css
/* Consistent spacing */
--gap-sm: 0.5rem;   /* 8px */
--gap-md: 0.75rem;  /* 12px */
--gap-lg: 1.5rem;   /* 24px */

/* Padding */
--pad-card: 1.5rem; /* p-6 */
--pad-section: 1rem; /* p-4 */
```

## 🧩 Components

### Cards

```tsx
// Agent Card
<Card className="
  bg-black 
  border border-zinc-900 
  hover:border-emerald-500/30 
  transition-colors
  p-6
">
  {/* Content */}
</Card>
```

**Visual:**
```
┌─────────────────────────────────┐
│  🤖 Agent Name                  │ ← font-light tracking-wide
│  Task description here...       │ ← text-zinc-500 font-light
│                                 │
│  github/user/repo  [COMPLETED]  │ ← font-mono, badge
│                                 │
│  main → agent-branch            │ ← font-mono text-xs
│  2025-01-15                     │ ← font-mono text-xs
│                                 │
│  [Start]  [Delete]              │ ← Emerald border buttons
└─────────────────────────────────┘
```

### Buttons

```tsx
// Primary Action
<Button className="
  bg-black 
  border border-emerald-500/50 
  text-emerald-400 
  hover:bg-emerald-500/10
">
  Primary Action
</Button>

// Secondary
<Button className="
  bg-black 
  border border-zinc-800 
  text-zinc-400 
  hover:border-emerald-500/30 
  hover:text-emerald-400
">
  Secondary Action
</Button>

// Destructive
<Button className="
  bg-black 
  border border-zinc-900 
  text-zinc-600 
  hover:border-red-500/50 
  hover:text-red-400
">
  Delete
</Button>
```

### Badges

```tsx
// Status Badge
<Badge className="
  bg-black/40 
  text-emerald-400 
  border-emerald-500/50 
  text-xs 
  font-mono
  px-3 py-1.5
">
  RUNNING
</Badge>
```

**States:**
```
[IDLE]      → zinc-500, zinc-800
[CLONING]   → zinc-400, zinc-700
[RUNNING]   → emerald-400, emerald-500/50
[COMPLETED] → emerald-400, emerald-500/50
[ERROR]     → red-400, red-500/50
[PUSHING]   → zinc-400, zinc-700
```

### Input Fields

```tsx
<Input className="
  bg-black 
  border border-zinc-900 
  text-zinc-100 
  focus:border-emerald-500/50 
  focus:ring-1 
  focus:ring-emerald-500/20
  font-light
" />
```

### Modals/Dialogs

```tsx
<DialogContent className="
  bg-black 
  border border-zinc-900 
  max-w-2xl
">
  <DialogHeader>
    <DialogTitle className="
      text-xl 
      font-light 
      tracking-wide 
      text-zinc-100
    ">
      MODAL TITLE
    </DialogTitle>
  </DialogHeader>
  {/* Content */}
</DialogContent>
```

## 📐 Layout Patterns

### Dashboard Header

```tsx
<div className="
  border-b border-zinc-900 
  px-6 py-4 
  bg-black
">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-emerald-400" />
      <h1 className="
        text-lg 
        font-light 
        tracking-wider 
        text-zinc-100
      ">
        SECTION NAME
      </h1>
      <div className="
        px-2 py-0.5 
        bg-black 
        border border-zinc-800 
        text-zinc-500 
        text-xs 
        font-mono
      ">
        12
      </div>
    </div>
    <Button>Action</Button>
  </div>
</div>
```

### Grid Layout

```tsx
<div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
  {items.map(item => (
    <Card key={item.id}>
      {/* Content */}
    </Card>
  ))}
</div>
```

### Split View

```tsx
<div className="flex h-screen bg-black">
  {/* Left Panel */}
  <div className="flex-1 border-r border-zinc-900">
    {/* Content */}
  </div>
  
  {/* Right Panel */}
  <div className="w-96">
    {/* Content */}
  </div>
</div>
```

## 🎭 States & Interactions

### Hover States

```css
/* Cards */
border-zinc-900 → hover:border-emerald-500/30

/* Buttons - Primary */
bg-black border-emerald-500/50 → hover:bg-emerald-500/10

/* Buttons - Secondary */
border-zinc-800 text-zinc-400 → hover:border-emerald-500/30 hover:text-emerald-400

/* Buttons - Destructive */
border-zinc-900 text-zinc-600 → hover:border-red-500/50 hover:text-red-400
```

### Focus States

```css
/* Inputs */
border-zinc-900 → focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20
```

### Loading States

```tsx
<Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
```

## 📱 Responsive Behavior

### Breakpoints

```css
/* Mobile First */
.grid {
  grid-template-columns: 1fr;
}

/* Tablet */
@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop */
@media (min-width: 1280px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

## 🔤 Content Patterns

### Technical Information

```tsx
// Repository info
<div className="
  flex items-center gap-2 
  text-sm text-zinc-500 
  px-3 py-2 
  bg-black 
  border border-zinc-900
">
  <Github className="h-4 w-4 shrink-0" />
  <span className="truncate font-mono text-xs">
    github/user/repository
  </span>
</div>

// Branch info
<div className="flex items-center gap-2 text-sm text-zinc-600">
  <GitBranch className="h-4 w-4" />
  <span className="text-xs font-mono">
    main → feature-branch
  </span>
</div>

// Timestamp
<div className="flex items-center gap-2 text-xs text-zinc-700">
  <Clock className="h-4 w-4" />
  <span className="font-mono">
    2025-01-15
  </span>
</div>
```

### Error Display

```tsx
<div className="p-3 bg-black border border-red-500/50">
  <p className="text-xs text-red-400 font-mono">
    Error message here
  </p>
</div>
```

### Empty States

```tsx
<Card className="p-20 bg-black border border-zinc-900 text-center">
  <Icon className="h-16 w-16 text-zinc-800 mx-auto mb-6" />
  <h3 className="
    text-2xl 
    font-light 
    tracking-wide 
    mb-3 
    text-zinc-100
  ">
    No items yet
  </h3>
  <p className="text-zinc-600 mb-10 font-light">
    Description text
  </p>
  <Button>Create First Item</Button>
</Card>
```

## 🎨 Design Principles

### 1. Minimize Visual Noise
- No gradients
- No shadows (except functional focus rings)
- No animations (except spinners)
- Flat, clean design

### 2. Functional Color
- Emerald = Primary action / Success
- Red = Error / Destructive
- Zinc grays = Hierarchy
- Color only when meaningful

### 3. Information Density
- Use space effectively
- Group related info
- Clear visual separation
- Monospace for technical data

### 4. Consistent Interaction
- Borders indicate interactivity
- Color change on hover
- Emerald = confirmation
- Red = caution

### 5. Accessibility
- High contrast (black + light text)
- Clear focus states
- Readable font sizes
- Descriptive colors

## 🛠️ Implementation Guide

### Quick Start Template

```tsx
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function MyComponent() {
  return (
    <div className="h-screen bg-black">
      {/* Header */}
      <div className="border-b border-zinc-900 px-6 py-4 bg-black">
        <h1 className="text-lg font-light tracking-wider text-zinc-100">
          TITLE
        </h1>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          <Card className="
            p-6 
            bg-black 
            border border-zinc-900 
            hover:border-emerald-500/30 
            transition-colors
          ">
            {/* Card content */}
          </Card>
        </div>
      </div>
    </div>
  );
}
```

### Common Patterns

```tsx
// Section with action
<div className="flex items-center justify-between mb-6">
  <h2 className="text-base font-light tracking-wide text-zinc-100">
    Section
  </h2>
  <Button className="
    bg-black 
    border border-emerald-500/50 
    text-emerald-400 
    hover:bg-emerald-500/10
  ">
    Action
  </Button>
</div>

// Info row
<div className="flex items-center gap-2 text-sm text-zinc-500">
  <Icon className="h-4 w-4" />
  <span className="font-mono text-xs">info</span>
</div>

// Status indicator
<div className="
  px-2 py-0.5 
  bg-black/40 
  border border-emerald-500/50 
  text-emerald-400 
  text-xs 
  font-mono
">
  STATUS
</div>
```

## ✅ Design Checklist

When creating new components:

- [ ] Background is pure black (#000000)
- [ ] Borders are zinc-900 or emerald-500/50
- [ ] Text uses font-light
- [ ] Technical info uses font-mono
- [ ] Headers use tracking-wider
- [ ] No gradients used
- [ ] No shadows (except focus)
- [ ] Hover states defined
- [ ] Emerald for primary actions
- [ ] Red only for errors
- [ ] Consistent spacing (gap-6, p-6)
- [ ] Responsive breakpoints
- [ ] Accessible contrast

## 🎯 Result

**A clean, professional, futuristic interface that:**
- Focuses attention on content
- Uses color purposefully
- Maintains visual consistency
- Scales beautifully
- Performs flawlessly