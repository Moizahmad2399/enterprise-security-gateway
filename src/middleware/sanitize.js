const xss = require('xss');
// Strips HTML/script payloads from every string in body + query (NoSQL operators handled by express-mongo-sanitize)
const clean = (v) => {
  if (typeof v === 'string') return xss(v);
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') { for (const k of Object.keys(v)) v[k] = clean(v[k]); return v; }
  return v;
};
module.exports = (req, _res, next) => { clean(req.body); clean(req.query); next(); };
