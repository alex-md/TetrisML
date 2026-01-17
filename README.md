# EVO_TETRIS: Genetic AI Aquarium

A web-based "aquarium" for Tetris AI, allowing real-time observation of an evolving population of agents. Featuring a Cloudflare Workers backend for infinite persistence.

## 🚀 Quick Start (Local Development)

### 1. Frontend Setup
1.  **Install dependencies**:
    `npm install`
2.  **Run the app**:
    `npm run dev`

### 2. Backend Setup
The backend handles persistent storage of the genetic population.
1.  **Navigate to backend**:
    `cd backend`
2.  **Install dependencies**:
    `npm install`
3.  **Run local worker**:
    `npm run dev`
    *(Starts at http://localhost:8787)*

---

## ☁️ Cloudflare Deployment

### 1. Deploy the Backend (Worker)
The backend uses Cloudflare KV for persistence.

1.  **Login to Wrangler**:
    `npx wrangler login`
2.  **Create KV Namespace**:
    Create a KV namespace in your Cloudflare Dashboard (Workers & Pages -> KV).
3.  **Update Config**:
    In `backend/wrangler.toml`, Replace `TETRIS_STATE_ID` with your actual KV Namespace ID.
4.  **Deploy**:
    `cd backend && npm run deploy`

### 2. Configure the Frontend
1.  Open `App.tsx`.
2.  Change `const API_BASE` to match your newly deployed worker URL (e.g., `https://tetrisml.yourname.workers.dev`).

### 3. Deploy the Frontend (Pages)
1.  Run `npm run build`.
2.  Upload the `dist` folder to Cloudflare Pages via the dashboard or using `npx wrangler pages deploy dist`.

---

## 🧠 System Architecture

- **Frontend**: React + Vite, visualizing agent states in real-time.
- **Worker Thread**: The heavy lifting (Tetris logic, GA evolution) runs in a dedicated Web Worker to keep the UI fluid.
- **Backend**: Cloudflare Worker + KV. Periodically syncs the population genome so progress persists across sessions.
- **Persistence**: Auto-saves every 10 seconds to both `localStorage` (for offline/immediate) and the Worker backend (for "infinite" survival).

## 🛠️ Tech Stack
- **Engine**: Custom Bitboard-inspired Tetris Logic
- **AI**: Genetic Algorithm / Neural Heuristic Search
- **UI**: Tailwind CSS + Lucide Icons
- **Persistence**: Cloudflare Workers + KV


1. npm run deploy
2. npm run build
3. npx wrangler pages deploy dist
