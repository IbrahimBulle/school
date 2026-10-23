# Northstar Academy school workspace

React frontend for the school management API.

## Run locally

1. Start the Go API on `http://localhost:8080`.
2. From this folder, run `npm install` if needed, then `npm run dev`.
3. Open the Vite URL and sign in with an administrator account.

Vite proxies `/api/*` to the Go server and strips the `/api` prefix. For deployment, route `/api` to the backend or set `VITE_API_BASE_URL` to the API origin and configure credentialed CORS and cookies on the backend.

## Administrator features

- Live overview of students, teachers, classes, terms, and pending marks
- Student enrolment and class/status updates
- Teacher account and profile creation, status updates, and teaching assignments
- Class and unit management
- Term creation and updates, mark approvals and rejections
- Fee structures and items, student fee accounts, class balances, payment recording, and fee PDFs
- User directory and a CSV export of student records

The API currently has no endpoints for password changes/resets, listing payments, or attendance reporting. Those actions are shown as unavailable where relevant.
