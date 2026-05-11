# FitCheck

FitCheck is a web app where users can upload or take outfit photos.  
This first version focuses on image capture/upload and storage for future scoring.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env.local
```

3. Add a Vercel Blob token to `.env.local`:

```bash
BLOB_READ_WRITE_TOKEN=your_vercel_blob_read_write_token
```

4. Run the app:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Import this project to Vercel.
2. In project settings, add `BLOB_READ_WRITE_TOKEN` as an environment variable.
3. Deploy.

The upload endpoint is `POST /api/uploads` and stores files in Vercel Blob.
