# Chiến English 🇻🇳🇬🇧

<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  
  [![Deploy to Cloudflare Pages](https://github.com/quemanhmcr/chien-english/actions/workflows/deploy.yml/badge.svg)](https://github.com/quemanhmcr/chien-english/actions/workflows/deploy.yml)
  [![Cloudflare Pages](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Pages-F38020?logo=cloudflare)](https://chien-english.pages.dev)
</div>

Ứng dụng học tiếng Anh dành cho người Việt với AI, cung cấp luyện tập dịch Việt-Anh kèm phản hồi chi tiết, sửa lỗi ngữ pháp và chấm điểm theo thời gian thực.

## 🌐 Production URL

**https://chien-english.pages.dev**

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- Node.js >= 18
- npm or yarn
- MiMo API Key (for AI grading)
- Supabase Project (for auth & database)

### 1. Clone & Install

```bash
git clone https://github.com/quemanhmcr/chien-english.git
cd chien-english
npm install
```

### 2. Setup Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Supabase (required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# MiMo API (for local development with Vite proxy)
MIMO_API_KEY=your_mimo_api_key
```

### 3. Run Development Server

```bash
npm run dev
```

App will be available at: **http://localhost:3000**

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│    Browser      │ ──▶ │  Cloudflare Pages    │ ──▶ │   MiMo API      │
│   (React App)   │     │  + Functions         │     │  (AI Grading)   │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │    Supabase     │
                        │  (Auth + DB)    │
                        └─────────────────┘
```

### Key Design Decisions

| Aspect | Decision | Reason |
|--------|----------|--------|
| **Hosting** | Cloudflare Pages | Free, fast, global CDN |
| **API Security** | Cloudflare Functions proxy | API keys never exposed to browser |
| **CI/CD** | GitHub Actions | Auto-deploy on push to `main` |
| **Auth** | Supabase Auth | Easy, secure, supports multiple providers |

---

## 📁 Project Structure

```
chien-english/
├── components/          # React components
├── services/            # API services (mimoService, authService)
├── functions/           # Cloudflare Pages Functions
│   └── api-mimo/        # Proxy for MiMo API (server-side)
├── .github/workflows/   # GitHub Actions CI/CD
├── .env.example         # Environment variables template
├── vite.config.ts       # Vite configuration
├── wrangler.toml        # Cloudflare Pages configuration
└── package.json
```

---

## 🔐 Environment Variables

### Client-Side (exposed to browser)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |

### Server-Side (Cloudflare Functions only)

| Variable | Description | Where to Set |
|----------|-------------|--------------|
| `MIMO_API_KEY` | MiMo AI API key | Cloudflare Pages Settings |

> ⚠️ **Security Note:** `MIMO_API_KEY` is NEVER sent to the browser. It's only used by Cloudflare Functions server-side.

---

## 🚢 Deployment

### Automatic (Recommended)

Push to `main` branch → GitHub Actions automatically builds and deploys to Cloudflare Pages.

```bash
git add .
git commit -m "Your changes"
git push origin main
```

### Manual

```bash
npm run deploy
```

---

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run deploy` | Manual deploy to Cloudflare Pages |
| `npm run typecheck` | Run TypeScript type checking |

---

## 🛠️ Setting Up Secrets (For New Team Members)

### GitHub Secrets (for CI/CD)

Go to: `Settings → Secrets and variables → Actions`

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Pages edit permission |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `MIMO_API_KEY` | MiMo API key |

### Cloudflare Pages Environment Variables

Go to: `Cloudflare Dashboard → Pages → chien-english → Settings → Environment Variables`

| Variable | Environment |
|----------|-------------|
| `MIMO_API_KEY` | Production (and Preview if needed) |

---

## 📖 Contributing

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Make your changes
3. Test locally with `npm run dev`
4. Commit: `git commit -m "feat: Add amazing feature"`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

---

## 📝 License

This project is private. All rights reserved.

---

<div align="center">
  Made with ❤️ for Vietnamese English learners
</div>
