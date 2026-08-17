# QuickNotes Frontend

Frontend web application for QuickNotes — a clean, collaborative rich-text editor and multiplayer speed typing test.

Built with React 19, Vite, Quill, and Socket.IO.

## Features

- **Live Collaboration**: Edit notes together in real-time with instant sync and active user counts.
- **Rich Text Editor**: Formatted headers, checklists, code blocks, lists, links, images, and undo/redo history using Quill 2.
- **Speed Typing & Race Mode**: Solo typing speed practice and real-time multiplayer racing against collaborators in the room. Includes audio keypress effects and live WPM/accuracy tracking.
- **Templates**: Starter templates for meeting notes, PRDs, sprint tasks, and tech specs.
- **Export Options**: Download notes as Markdown (`.md`), HTML (`.html`), Plain Text (`.txt`), or print to PDF.
- **Customizable Appearance**: Light and dark mode support, paper tints (White, Sepia, Mint, Slate), and font switching (Sans, Serif, Mono).
- **Recent Notes**: Slide-out drawer with your recently accessed notes stored locally.
- **Mobile Responsive**: Clean layout optimized for mobile screens and tablets.

## Tech Stack

- **React 19**
- **Vite 6**
- **Quill 2**
- **Socket.IO Client**
- **Lucide React** (icons)
- **Vanilla CSS** (custom design system)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in this directory:

```env
VITE_BACKEND_URL=http://localhost:3000
```

> In production, change `VITE_BACKEND_URL` to your deployed backend URL.

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Available Scripts

- `npm run dev`: Starts the Vite development server with hot module reloading.
- `npm run build`: Compiles and bundles production files into the `dist/` directory.
- `npm run preview`: Previews the production build locally.

## Deployment (Vercel)

1. Import the repository into Vercel.
2. In **Project Settings ➔ General**, set the Node.js version to **`22.x`** (or `20.x`).
3. Under **Environment Variables**, set `VITE_BACKEND_URL` to your backend server URL.
4. Deploy. (Client-side routing rules are already configured in `vercel.json`).
