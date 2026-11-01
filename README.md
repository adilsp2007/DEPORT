# DEPORT — Carry Your Style | Premium Bag Store

A production-ready e-commerce platform built with Python, Django, Django REST Framework, SimpleJWT, React.js, Tailwind CSS, and Lucide React.

## Authentication Architecture (Steps 3 & 4)

DEPORT utilizes a unified authentication strategy supporting both **Email/Password** and **Google OAuth 2.0** powered by `djangorestframework-simplejwt`.

### Token Specifications
- **Access Tokens**: Short-lived (15 minutes by default). Passed via standard HTTP header: `Authorization: Bearer <access_token>`.
- **Refresh Tokens**: Long-lived (7 days by default). Passed to `/api/auth/refresh/` for seamless access token rotation. Blacklisted on logout.

### Authentication API Endpoints
| HTTP Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register/` | User registration (first_name, last_name, email, password) | Public |
| `POST` | `/api/auth/login/` | Email/password user authentication & JWT issuance | Public |
| `POST` | `/api/auth/google/` | Google OAuth token verification, account linking & JWT issuance | Public |
| `GET` | `/api/auth/google/config/` | Public Google OAuth client configuration endpoint | Public |
| `POST` | `/api/auth/refresh/` | Issue new access token using refresh token | Public |
| `POST` | `/api/auth/logout/` | Blacklist refresh token & clear auth session | Authenticated |
| `GET` | `/api/auth/me/` | Retrieve current authenticated user details | Authenticated |

---

## Google Cloud Console OAuth Setup Instructions

1. **Create/Select a Google Cloud Project**:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/).
   - Click the project selector dropdown and create a new project (e.g. `DEPORT Bag Store`).
2. **Configure OAuth Consent Screen**:
   - Navigate to **APIs & Services > OAuth consent screen**.
   - Select **User Type**: `External` and click **Create**.
   - Fill in App Name (`DEPORT Bag Store`), User Support Email, and Developer Contact Information.
   - Add scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
3. **Create OAuth 2.0 Client Credentials**:
   - Navigate to **APIs & Services > Credentials**.
   - Click **Create Credentials > OAuth client ID**.
   - Select **Application type**: `Web application`.
   - Set Name: `DEPORT Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
     - `http://localhost:5174`
   - **Authorized redirect URIs**:
     - `http://localhost:5174/auth/google/callback`
   - Click **Create** and copy your **Client ID** and **Client Secret**.
4. **Environment Configuration**:
   - Paste `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into `backend/.env`.
   - Never expose `GOOGLE_CLIENT_SECRET` to the frontend or git repositories.

---

## Getting Started & Running Locally

### 1. Backend Setup (Django REST Framework)
```bash
cd backend
python -m pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py seed_store
python manage.py test users     # Runs authentication test suite (10 tests)
python manage.py runserver 8000
```

### 2. Frontend Setup (React + Vite)
```bash
cd frontend
npm install
npm run build
npm run dev
```

The frontend application runs at `http://localhost:5174/` and connects to `http://localhost:8000/api/`.

---

## Environment Variables

### Backend `.env`
```env
DEBUG=True
SECRET_KEY=django-insecure-deport-bag-store-key-development-2026

DATABASE_NAME=deport_db
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432

FRONTEND_URL=http://localhost:5173,http://localhost:5174

JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5174/auth/google/callback
```

### Frontend `.env`
```env
VITE_API_URL=http://localhost:8000/api
```
