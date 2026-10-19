import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';

import coreRoutes from './routes/core.routes.js';
import salesRoutes from './routes/sales.routes.js';
import projectRoutes from './routes/projects.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import workforceRoutes from './routes/workforce.routes.js';
import financeRoutes from './routes/finance.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportRoutes from './routes/reports.routes.js';
import notificationRoutes from './routes/notifications.routes.js';
import crmRoutes from './routes/crm.routes.js';
import hrRoutes from './routes/hr.routes.js';
import { notFound, errorHandler } from './middleware/error.js';

const isProd = process.env.NODE_ENV === 'production';
// Sub-path the whole app lives under, e.g. "/cms" for https://unizova.com/cms ("" = domain root)
const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('change_this'))) {
  console.error('✖ Set a strong JWT_SECRET in server/.env before running in production');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1); // behind nginx / load balancer
app.disable('x-powered-by');
fs.mkdirSync('uploads', { recursive: true });

app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(`${BASE}/uploads`, express.static(path.resolve('uploads'), { maxAge: '7d' }));

app.get(`${BASE}/api/health`, (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

// coreRoutes registers /auth/login (public) and then applies `protect` to everything after it
app.use(`${BASE}/api`, coreRoutes, salesRoutes, projectRoutes, inventoryRoutes, workforceRoutes, financeRoutes, crmRoutes, hrRoutes, dashboardRoutes, reportRoutes, notificationRoutes);

// Serve the built React app (client/dist) with SPA fallback
const clientDist = path.resolve('../client/dist');
if (fs.existsSync(clientDist)) {
  // "/cms" -> "/cms/" (Express treats both as the same route, so check the raw URL to avoid a loop)
  if (BASE) app.get(BASE, (req, res, next) => (req.originalUrl.split('?')[0] === BASE ? res.redirect(301, `${BASE}/`) : next()));
  app.use(BASE || '/', express.static(clientDist, { index: false, maxAge: '30d', setHeaders: (res, file) => file.endsWith('.html') && res.setHeader('Cache-Control', 'no-cache') }));
  app.use(BASE || '/', (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✔ MongoDB connected');
    app.listen(PORT, () => console.log(`✔ Server running on http://localhost:${PORT}${BASE || '/'}`));
  })
  .catch((err) => {
    console.error('✖ MongoDB connection failed:', err.message);
    process.exit(1);
  });
