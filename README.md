# GreenChoice Workstation

Next.js staff frontend for the GreenChoice MVP.

Production URL:

```text
https://greenchoice-workstation.vercel.app
```

## Local Run

Start the Django backend from the repository root:

```bash
python manage.py migrate
python manage.py seed_greenchoice_staff
python manage.py seed_greenchoice_demo
python manage.py runserver
```

Start the frontend:

```bash
cd greenchoice-workstation
npm install
npm run dev
```

Open `http://127.0.0.1:3001/login`.

## Environment

Local `.env.local`:

```bash
GREENCHOICE_API_BASE_URL=http://127.0.0.1:8000/api/v2
APP_URL=http://127.0.0.1:3001
CSRF_SECRET=replace-with-a-long-random-secret
SESSION_SIGNING_SECRET=replace-with-a-long-random-secret
STAFF_SESSION_SIGNING_SECRET=replace-with-a-long-random-secret
```

Vercel production:

```bash
GREENCHOICE_API_BASE_URL=https://greenchoice-api.onrender.com/api/v2
APP_URL=https://greenchoice-workstation.vercel.app
CSRF_SECRET=<long random secret>
SESSION_SIGNING_SECRET=<long random secret>
STAFF_SESSION_SIGNING_SECRET=<long random secret>
```

`GREENCHOICE_API_BASE_URL` is required in production. The app does not fall back to a local API when deployed.

## Development Staff Logins

Manager:

- Email: `manager@greenchoice.local`
- Password: `ChangeMe123!`
- Role: `MANAGER`

Receptionist:

- Email: `receptionist@greenchoice.local`
- Password: `ChangeMe123!`
- Role: `RECEPTIONIST`

These credentials are only for development/testing. Change seeded passwords before using the system in production.

## Dashboard Routes

- `/login`
- `/dashboard/manager`
- `/dashboard/manager/products`
- `/dashboard/manager/products/new`
- `/dashboard/manager/products/category/[slug]`
- `/dashboard/manager/inventory`
- `/dashboard/manager/sales`
- `/dashboard/manager/staff`
- `/dashboard/manager/low-stock`
- `/dashboard/manager/promotions`
- `/dashboard/manager/categories`
- `/dashboard/receptionist`
- `/dashboard/receptionist/products`
- `/dashboard/receptionist/customers/register`
- `/dashboard/receptionist/checkout`
