# Enterprise Multi-Tenant Security Gateway (CSC337 Lab 05)

Express + MongoDB gateway with hybrid auth (bcrypt local + GitHub OAuth 2.0), rotating refresh tokens, RBAC and OWASP hardening.
## Screenshots:
<img width="1907" height="887" alt="image" src="https://github.com/user-attachments/assets/3a618eb3-a208-4c8a-b8d7-db22ab18f993" />

<img width="1917" height="897" alt="image" src="https://github.com/user-attachments/assets/14f20d36-d68b-4a69-b971-786dbaf6bc2c" />

<img width="1910" height="902" alt="image" src="https://github.com/user-attachments/assets/03f611f9-5ca8-4912-b784-4e8961c54392" />



**Live app:** https://securegate-moiz.onrender.com/  
**API base:** https://securegate-moiz.onrender.com/api/v1

## Test credentials
| Role | Email | Password |
|---|---|---|
| SuperAdmin | superadmin@test.com | Test@12345 |
| Manager | manager@test.com | Test@12345 |
| Employee | employee@test.com | Test@12345 |

## Security design
| Area | Implementation |
|---|---|
| Passwords | bcrypt, cost 12; no plain text stored; dummy-hash compare avoids user enumeration |
| Brute force | `express-rate-limit` 5 failed logins / 15 min / IP, plus per-account lockout after 5 fails |
| Access token | JWT, 15 min, `Authorization: Bearer` |
| Refresh token | JWT, 7 days, `httpOnly; Secure; SameSite=Strict` cookie scoped to `/api/v1/auth` |
| Rotation | Each `/auth/refresh` revokes the old token (stored by `jti`) and issues a new one; reuse of an old token revokes all of that user's sessions |
| Logout | Refresh token revoked in DB, cookie cleared |
| OAuth | GitHub via Passport, CSRF `state` check, profile synced/linked by email, new users default to Employee |
| RBAC | `checkRole([...])` middleware; roles are never accepted from client input |
| Hardening | Helmet, strict CORS allow-list, `express-mongo-sanitize`, `xss` sanitizer, 10 kb body limit |

## RBAC matrix
| Route | SuperAdmin | Manager | Employee |
|---|---|---|---|
| GET /employee/profile | ✅ | ✅ | ✅ |
| POST /payroll/approve | ✅ | ✅ | ❌ 403 |
| DELETE /users/:id | ✅ | ❌ 403 | ❌ 403 |

## Run locally
```powershell
npm install
copy .env.example .env   # fill values
npm run seed
npm run dev
```
GitHub OAuth app: callback URL = `${BASE_URL}/api/v1/auth/github/callback`.

## Deploy (Render)
Build: `npm install` · Start: `npm start`. Set env vars from `.env.example` (`NODE_ENV=production`, `BASE_URL` and `CLIENT_ORIGIN` = your Render URL). Use MongoDB Atlas (allow 0.0.0.0/0). Run `npm run seed` once locally against the Atlas URI.
