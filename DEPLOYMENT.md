# Deployment Guide - Railway + Vercel

## 🚂 Backend Deployment (Railway)

### 1. Create PostgreSQL Database
1. Go to Railway Dashboard
2. Click "New Project"
3. Select "Provision PostgreSQL"
4. Database will be created automatically

### 2. Deploy Backend Service
1. Click "New Service" in the same project
2. Select "GitHub Repo"
3. Choose `tracker_all_trader` repository
4. Railway will auto-detect Node.js and deploy

### 3. Configure Environment Variables
Railway will automatically set `DATABASE_URL` from PostgreSQL service.

Optional variables (Railway auto-configures most):
```
NODE_ENV=production
PORT=3000
```

### 4. Verify Deployment
1. Check service logs in Railway dashboard
2. Wait for "Scheduler started" message
3. Test health endpoint: `https://your-app.railway.app/health`

### 5. Get Backend URL
Copy your Railway backend URL (e.g., `https://your-app.railway.app`)
You'll need this for Vercel deployment.

---

## ▲ Frontend Deployment (Vercel)

### 1. Import Project
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import from GitHub: `tracker_all_trader`
4. Select root directory: `/dashboard`

### 2. Configure Build Settings
```
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

### 3. Environment Variables
Add this in Vercel project settings:
```
NEXT_PUBLIC_BACKEND_URL=https://your-app.railway.app
```

### 4. Deploy
Click "Deploy" and wait for build to complete.

---

## ✅ Verification Checklist

### Backend (Railway)
- [ ] PostgreSQL database running
- [ ] Backend service deployed
- [ ] Health endpoint returns 200: `/health`
- [ ] Scheduler is running (check logs for "Scrape cycle")
- [ ] API endpoints working: `/signals/heatmap`

### Frontend (Vercel)
- [ ] Dashboard accessible
- [ ] Can see heatmap data
- [ ] Consensus signals page works
- [ ] Real-time data updates

---

## 🔧 Troubleshooting

### Backend Issues

**Migrations not running:**
```bash
# Railway will auto-run migrations on deploy
# If needed, manually run in Railway service shell:
npm run db:migrate
npm run db:generate
```

**Scheduler not starting:**
Check logs for errors. Ensure all dependencies installed.

**Database connection errors:**
Verify `DATABASE_URL` environment variable is set correctly.

### Frontend Issues

**Can't fetch data:**
- Check `NEXT_PUBLIC_BACKEND_URL` is set correctly
- Verify backend is running
- Check CORS settings in backend

**Build fails:**
- Clear Vercel cache and redeploy
- Check Node.js version compatibility

---

## 📊 Monitoring

### Railway
- View logs: Railway Dashboard → Service → Logs
- Monitor metrics: CPU, Memory, Network usage
- Set up alerts for failures

### Vercel
- View deployments: Vercel Dashboard → Project → Deployments
- Monitor analytics: Real-time visitor stats
- Check function logs for API routes

---

## 💰 Cost Estimates

**Railway:**
- PostgreSQL: ~$2-3/month
- Backend Service: ~$1-2/month
- **Total: ~$3-5/month** (covered by $5 free credit)

**Vercel:**
- Hobby plan: **FREE**
- Bandwidth: Unlimited for hobby
- Build minutes: 100 hours/month

**Grand Total: ~$0-5/month** 🎉
