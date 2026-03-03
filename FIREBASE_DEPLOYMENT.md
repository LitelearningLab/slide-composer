# Firebase Deployment Guide for Slide Composer

## Option 1: Cloud Run (Recommended for Full-Stack)

This deploys the entire app (frontend + backend) to a single Cloud Run service.

### Prerequisites
```bash
npm install -g firebase-tools
firebase login
```

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Enter project name (e.g., "slide-composer")
4. Enable billing (required for Cloud Run)

### Step 2: Initialize Firebase in Your Project
```bash
cd 'C:\Users\vanan\Downloads\Slide-Composer (6)\Slide-Composer'
firebase init hosting
# Choose: Use an existing project
# Select your project
# Public directory: dist (will be created during build)
# Configure as SPA: Yes
```

### Step 3: Build and Deploy

Create a `build-and-deploy.sh` script:
```bash
# Build frontend
cd client
npm run build
cd ..

# Copy built frontend to public folder for Cloud Run
mkdir -p dist/public
cp -r client/dist/* dist/public/

# Deploy to Cloud Run
firebase deploy --only hosting
```

Or manually:

```powershell
# 1. Build frontend
cd client
npm run build
cd ..

# 2. Set environment for production
$env:NODE_ENV = "production"
$env:OPENAI_API_KEY = "your-api-key-here"
$env:AI_INTEGRATIONS_OPENAI_API_KEY = "your-api-key-here"

# 3. Deploy to Cloud Run
firebase init
# Select Cloud Run option during setup
gcloud builds submit --tag gcr.io/YOUR-PROJECT-ID/slide-composer
gcloud run deploy slide-composer --image gcr.io/YOUR-PROJECT-ID/slide-composer --platform managed --region us-central1
```

---

## Option 2: Separate Frontend & Backend

Deploy frontend to Firebase Hosting and backend to Cloud Run.

### Frontend (Firebase Hosting)
```bash
cd client
npm run build
cd ..
firebase deploy --only hosting
```

### Backend (Cloud Run)
```powershell
# Create a .gcloudignore file (similar to .gitignore)
# Then deploy:
gcloud builds submit --tag gcr.io/YOUR-PROJECT-ID/slide-composer-backend
gcloud run deploy slide-composer-backend \
  --image gcr.io/YOUR-PROJECT-ID/slide-composer-backend \
  --platform managed \
  --region us-central1 \
  --set-env-vars OPENAI_API_KEY=your-key,AI_INTEGRATIONS_OPENAI_API_KEY=your-key
```

---

## Step-by-Step Instructions

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### 2. Create Dockerfile (for Cloud Run)
Create `Dockerfile` in project root:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install --production

# Copy server code
COPY server ./server
COPY shared ./shared
COPY .env .env

# Build frontend
COPY client ./client
RUN cd client && npm install && npm run build && cd ..

# Expose port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production

# Start server
CMD ["npm", "run", "dev"]
```

### 3. Create firebase.json
```json
{
  "hosting": {
    "public": "client/dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### 4. Set Environment Variables in Firebase
```bash
firebase functions:config:set openai.api_key="your-api-key"
```

Or in Cloud Run:
```bash
gcloud run deploy slide-composer \
  --set-env-vars OPENAI_API_KEY="sk-proj-...",AI_INTEGRATIONS_OPENAI_API_KEY="sk-proj-..."
```

### 5. Deploy
```bash
# Option A: Deploy to Firebase Hosting only (frontend)
npm run build
firebase deploy --only hosting

# Option B: Deploy to Cloud Run (full stack)
gcloud builds submit --tag gcr.io/your-project/slide-composer
gcloud run deploy slide-composer --image gcr.io/your-project/slide-composer --platform managed --region us-central1
```

---

## Important Notes

1. **Update API Keys Securely**
   - Never commit API keys to git
   - Use Cloud Run secrets or Firebase Environment Variables
   - Remove keys from `.env` before deployment

2. **Environment Variables**
   - Firebase Hosting: Store in `firebase.json` or Cloud Functions
   - Cloud Run: Set via `gcloud run deploy --set-env-vars`

3. **Database** (if needed later)
   - Use Firestore for NoSQL
   - Or Cloud SQL for relational data

4. **Cost**
   - Firebase Hosting: Free tier includes 10GB storage, 360MB/day bandwidth
   - Cloud Run: Free tier includes 2M requests/month

5. **Domain**
   - Free: `your-project.firebaseapp.com`
   - Custom: Set in Firebase Console under Hosting settings
