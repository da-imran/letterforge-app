# 📚 LetterForge

Forge your words, climb the ranks, and master the dictionary. **LetterForge** is a fast-paced, high-performance word game built with Next.js.

## 🚀 Features

- **Dual Game Modes**:
  - **Normal Mode**: Take your time to forge the most complex words. Focus on precision and vocabulary depth.
  - **Time Attack**: Forge under pressure! You have 30 seconds to score as much as possible.
- **Dictionary Verified**: Real-time validation against a master word database ensures every forged word is legitimate.
- **Global Leaderboard**: Compete with players worldwide. Track rankings across Daily, Weekly, and All-Time periods.
- **Player Profiles**: Persistent user profiles with detailed statistics, total scores, and game history.
- **Responsive Design**: Fully optimized for desktop, tablet, and mobile play.
- **Modern UI**: Built with ShadCN UI and Tailwind CSS for a sleek, dark-themed aesthetic.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [ShadCN UI](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State Management**: React Context API
- **Animations**: Tailwind Animate & Framer Motion (ready)

## 🏁 Getting Started

> This package lives inside the **letterforge-app** monorepo. Install from the repo root: `npm install`. See the root [README](../../README.md) for the full monorepo quick-start.

### Prerequisites

- Node.js 20+ (npm is bundled with Node)

### Local development (this package only)

```bash
cd packages/dashboard
npm install              # only needed if running standalone
npm run dev              # starts Next.js on http://localhost:9002
```

The application will be available at `http://localhost:9002`.

### Environment variables

Create a `.env.local` in this directory (see `.env.example` for the full template):

```env
NEXT_PUBLIC_API_URL=http://localhost:8888
NEXT_PUBLIC_API_BASE=/letter-forge/v1
```

## 📂 Project Structure

- `src/app`: Next.js App Router pages and layouts.
- `src/components`: Reusable UI components (including ShadCN components).
- `src/context`: React Context providers for Auth and User state.
- `src/lib`: API client and utility functions.
- `src/types`: TypeScript interface and type definitions.

## 🔗 API Documentation

The frontend connects to a RESTful backend service. For a full list of the 21 available endpoints, see the root [README](../../README.md) or run the server and visit `http://localhost:8888/letter-forge/v1/api-docs`.

## ⚖️ License

MIT © LetterForge Team
