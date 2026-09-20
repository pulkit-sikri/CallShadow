# CallShadow - Architecture & Developer Guidelines

CallShadow is a mobile companion app for AI voice deepfake detection and live caller speaker verification, extending VocalShield AI.

## Project Conventions

### 1. Mock Service Layer Rule (Strict Isolation)
- All backend-bound operations **must** reside in `src/services/` (e.g. `authService.ts`, `analysisService.ts`, `liveCallService.ts`).
- UI screens and state stores **must never** execute arbitrary inline mocks or direct fetch logic.
- Every service function must:
  1. Return a typed `Promise<T>` using interfaces defined in `src/types/`.
  2. Simulate realistic network latency with a mock delay utility (`simulateDelay()`).
  3. Mirror the expected FastAPI backend payload and response contract for zero-friction Stage 2 swapping.

### 2. Tech Stack & Expo Go Compatibility
- **Runtime**: React Native + Expo (Managed Workflow, TypeScript).
- **No Custom Native Modules**: Must run cleanly in standard Expo Go by scanning QR code.
- **Routing**: `@react-navigation/native` with `@react-navigation/native-stack`.
- **State Management**: `zustand` for predictable, lightweight, type-safe global stores.
- **Styling**: Vanilla React Native `StyleSheet` combined with reusable design tokens (`src/theme/`).
- **Icons & Graphics**: `lucide-react-native`, `react-native-svg`, `expo-linear-gradient`.

### 3. Folder & File Structure
```
src/
├── theme/              # Color palettes, dark glassmorphic tokens, gradients, typography
├── types/              # Domain models (Auth, Analysis, LiveCall, Navigation)
├── services/           # Mock API service layer (Stage 2 migration point)
├── store/              # Zustand stores (useAuthStore, useAnalysisStore, useLiveCallStore)
├── components/         # Reusable glassmorphic UI widgets
│   ├── common/         # Buttons, cards, toggles, headers
│   ├── visualizers/    # Circular risk gauge, live waveform bars
│   ├── analysis/       # Signal breakdown metrics, chips
│   └── live/           # Push-to-talk, threat modals, session stats
├── screens/            # 6 Core App Screens
│   ├── LandingScreen.tsx
│   ├── AuthScreen.tsx
│   ├── DashboardScreen.tsx
│   ├── VoiceAnalysisScreen.tsx
│   ├── RiskResultsScreen.tsx
│   └── LiveCallScreen.tsx
└── navigation/         # Navigation container, RootStackNavigator
```

### 4. Design System & Aesthetics
- **Dark Theme Palette**:
  - Background: `#08080E` (Obsidian Base), `#0E0E1A` (Card Elevated)
  - Card Surface: `rgba(255, 255, 255, 0.04)` to `rgba(255, 255, 255, 0.08)` with border `rgba(255, 255, 255, 0.12)`
  - Primary Accent: Blue-to-Purple gradient (`#3B82F6` $\rightarrow$ `#8B5CF6`)
  - Risk Spectrum: Low/Authentic `#10B981` (Green) $\rightarrow$ Moderate `#F59E0B` (Amber) $\rightarrow$ High/Deepfake `#EF4444` (Crimson)
- **Border Radius**: Cards `16px - 20px`, Buttons `12px - 14px`, Badges `9999px` (Pills).
- **Typography**: Crisp, high-contrast typography with clear semantic hierarchy.

### 5. Specific Feature & Signal Constraints
- **Exact Signal Breakdown Labels**:
  1. `Pitch Consistency`
  2. `Breathing Patterns`
  3. `Micro-Pause Analysis`
  4. `Frequency Response`
- **Microphone Permissions**: Real `requestRecordingPermissionsAsync()` (`expo-audio`) permission flow with clean fallback UI before entering recording or live call screening.
- **Dashboard Scope**: Do NOT include the Live Threat Protection switch. Focus on the 3 primary action cards: Upload Audio, Record Audio, and Live Call Screening.
