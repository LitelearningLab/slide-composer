# SlideAI - AI-Powered Presentation Generator

## Overview

SlideAI is a web application that transforms structured text data into professional presentation slides using AI. Users paste raw content (like reports, notes, or outlines), select a visual theme, and the application generates a complete slide deck with proper formatting, titles, and content organization.

The application follows a monorepo structure with a React frontend, Express backend, and PostgreSQL database. It leverages OpenAI's API through Replit's AI Integrations for slide content generation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with CSS variables for theming
- **UI Components**: shadcn/ui component library (Radix UI primitives)
- **Build Tool**: Vite with HMR support

The frontend lives in `client/src/` with:
- `pages/` - Route components (home, create, not-found)
- `components/` - Reusable UI including slide renderers and theme cards
- `lib/` - Utilities, query client, and theme provider
- `hooks/` - Custom React hooks

### Backend Architecture
- **Framework**: Express 5 on Node.js
- **API Style**: RESTful JSON endpoints under `/api/`
- **AI Integration**: OpenAI API via Replit AI Integrations environment variables

Key server files:
- `server/index.ts` - Express app setup with middleware
- `server/routes.ts` - API route handlers for presentations
- `server/storage.ts` - In-memory storage implementation (IStorage interface)
- `server/vite.ts` - Vite dev server integration for development
- `server/static.ts` - Static file serving for production

### Data Storage
- **Development**: In-memory storage (MemStorage class)
- **Production-ready**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` using Zod for validation
- **Migrations**: `drizzle-kit` with config in `drizzle.config.ts`

The storage layer uses an interface pattern (IStorage) allowing easy swapping between memory and database implementations.

### Shared Code
The `shared/` directory contains:
- `schema.ts` - Zod schemas and TypeScript types for presentations, slides, and themes
- `models/chat.ts` - Drizzle table definitions for chat features (conversations, messages)

### Build System
- **Development**: `tsx` for TypeScript execution, Vite for frontend HMR
- **Production Build**: Custom script (`script/build.ts`) using esbuild for server, Vite for client
- **Output**: `dist/` folder with `index.cjs` (server) and `public/` (client assets)

### Replit Integrations
Pre-built integration modules in `server/replit_integrations/`:
- `audio/` - Voice chat with speech-to-text and text-to-speech
- `chat/` - Conversation storage and streaming chat endpoints
- `image/` - Image generation using OpenAI
- `batch/` - Rate-limited batch processing utilities

## External Dependencies

### AI Services
- **OpenAI API**: Accessed via `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` environment variables (Replit AI Integrations)
- Used for generating slide content from raw text input
- Text-to-speech (TTS) for audio narration using OpenAI's gpt-audio model via `/api/presentations/narrate` endpoint

### Presentation Features
- **Logic-based Slide Generation**: Rule-based parser (server/slideParser.ts) organizes content into slides by detecting headers, bullets, quotes, tables, and sections - no AI required for slide creation
- **Table Support**: Markdown tables with | separators are detected and rendered as formatted HTML tables
- **Fraction Formatting**: Common fractions (1/2, 1/4, 3/4, etc.) are automatically converted to Unicode fraction symbols (½, ¼, ¾)
- **6 Visual Themes**: Professional, Modern, Creative, Minimal, Bold, Elegant
- **Rich Animations**: Title slide-in, staggered content, accent bar animations
- **Auto-play Slideshow**: Configurable interval (2-15s), play/pause controls
- **AI Chat Sidebar**: Ask questions during presentation mode, navigates to referenced slides
- **Audio Narration**: TTS reads slide content aloud when enabled, with proper cleanup and race-condition guards

### Database
- **PostgreSQL**: Connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and migrations
- **connect-pg-simple**: Session storage (available but not currently active)

### Frontend Libraries
- **Radix UI**: Accessible component primitives (dialogs, menus, tooltips, etc.)
- **TanStack Query**: Data fetching and caching
- **Lucide React**: Icon library
- **date-fns**: Date formatting utilities

### Development Tools
- **Vite**: Frontend build and dev server
- **esbuild**: Server bundling for production
- **TypeScript**: Type checking across the codebase
- **Tailwind CSS**: Utility-first styling with custom theme configuration