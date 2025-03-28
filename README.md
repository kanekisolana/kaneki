# Kaneki

A modern web application built with Next.js, TypeScript, and Tailwind CSS that provides a platform for creating and managing AI agents and backrooms.

## Features

- 🤖 AI Agent Creation and Management
- 🏠 Backroom System
- 👤 User Profiles
- 💰 Token Feed Integration
- 🔒 Secure Authentication
- 🎨 Modern UI with Tailwind CSS & Shadcn

## Tech Stack

- **Framework:** Next.js 15
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **API:** tRPC
- **Database:** SQLite with Keyv
- **UI Components:** Radix UI
- **Authentication:** Solana Wallet Integration
- **AI Integration:** Google Generative AI, Together AI

## Prerequisites

- Node.js (Latest LTS version recommended)
- pnpm (v9.15.2 or later)
- Unified Wallet Kit (for authentication)

## Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/kanekisolana/kaneki.git
   cd kaneki
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Fill in the required environment variables in the `.env` file.

4. Start the development server:

   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/              # Next.js app router pages
├── components/       # Reusable UI components
├── hooks/           # Custom React hooks
├── lib/             # Utility functions and shared logic
├── server/          # Server-side code
├── store/           # Zustand state management
├── styles/          # Global styles
├── trpc/            # tRPC router and procedures
└── types/           # TypeScript type definitions
```

## Available Scripts

- `pnpm dev` - Start development server with Turbo
- `pnpm build` - Build the application
- `pnpm start` - Start the production server
- `pnpm preview` - Preview the production build
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues
- `pnpm format:check` - Check code formatting
- `pnpm format:write` - Format code
- `pnpm typecheck` - Run TypeScript type checking

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [tRPC](https://trpc.io/)
- [Solana](https://solana.com/)
