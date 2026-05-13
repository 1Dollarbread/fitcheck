# FitCheck

FitCheck is a mobile-first web app where users take outfit photos, get an AI
fit score, and save rated photos to an album.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env.local
```

3. Add your local environment values to `.env.local`:

```bash
BLOB_READ_WRITE_TOKEN=your_vercel_blob_read_write_token
GROQ_API_KEY=your_groq_api_key
RESEND_API_KEY=your_resend_api_key
AUTH_EMAIL_FROM="FitCheck <you@yourdomain.com>"
```

`BLOB_READ_WRITE_TOKEN` powers uploads, the album, and deletes through Vercel
Blob. `GROQ_API_KEY` powers the real AI outfit scan. If no Groq or OpenAI key is
set, FitCheck intentionally falls back to demo scoring so the UI still works.
`RESEND_API_KEY` powers email verification codes. Without it, local development
prints the code to the server log and returns it to the UI for testing.

4. Run the app:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Import this project to Vercel.
2. In project settings, add `BLOB_READ_WRITE_TOKEN`, `GROQ_API_KEY`,
   `RESEND_API_KEY`, and `AUTH_EMAIL_FROM` as environment variables.
3. Deploy.

The upload endpoint is `POST /api/uploads` and stores files in Vercel Blob.
