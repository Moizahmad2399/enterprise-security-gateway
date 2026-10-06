require('dns').setServers(['8.8.8.8','1.1.1.1']);
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
const passport = require('./config/passport');
const sanitize = require('./middleware/sanitize');
const { globalLimiter } = require('./middleware/rateLimit');

const app = express();
app.set('trust proxy', 1); // Render/Railway sit behind a proxy

app.use(helmet());
app.use(cors({
  origin: (process.env.CLIENT_ORIGIN || '').split(','),   // strict allow-list, no wildcard
  credentials: true,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize());   // blocks $ and . operators (NoSQL injection)
app.use(sanitize);          // strips XSS payloads
app.use(globalLimiter);
app.use(passport.initialize());

app.use(express.static(path.join(__dirname, '../public')));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1', require('./routes/api'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });

mongoose.connect(process.env.MONGO_URI).then(() => {
  app.listen(process.env.PORT || 5000, () => console.log('Gateway running'));
}).catch((e) => { console.error(e); process.exit(1); });
