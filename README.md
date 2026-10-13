# Intra Interiors — Construction & Interior Management ERP

MERN stack (MongoDB · Express 5 · React 19 + Vite 7 · Node) with Tailwind CSS 4, TanStack Query and Recharts.

## Quick start

Requirements: Node 20+ and MongoDB running locally (`mongodb://127.0.0.1:27017`).

```bash
npm run install:all     # installs root, server and client deps
npm run seed            # loads demo data (wipes the buildpro database)
npm run reset           # erases all data, keeps Super Admin login(s)
npm run dev             # API on :5000, web app on http://localhost:5173
```

Production (served under `/cms`): see **[DEPLOY.md](DEPLOY.md)** — live at https://unizova.com/cms/

Config lives in `server/.env` (copy from `server/.env.example`; **change `JWT_SECRET`**).

### Demo logins (password `password123`)

| Role | Email |
|---|---|
| Super Admin | superadmin@buildpro.in |
| Admin | admin@buildpro.in |
| Project Manager | pm@buildpro.in |
| Site Engineer | engineer@buildpro.in |
| Site Supervisor | supervisor@buildpro.in |
| Estimator | estimator@buildpro.in |
| Purchase Manager | purchase@buildpro.in |
| Accountant | accounts@buildpro.in |
| Designer | designer@buildpro.in |
| Store Manager | store@buildpro.in |
| Contractor (portal) | contractor@buildpro.in |
| Worker (portal) | worker@buildpro.in |
| Client (portal) | client@buildpro.in |

## Core flow

```
Lead → Client → Site Visit → BOQ → Quotation → Client Approval → Project → Work Plan
→ Material + Labour → Site Execution → Daily Progress → Measurement → Client Billing
→ Payment → Completion → Profit / Loss
```

Each step has a one-click action that carries data forward:

| From | Action (row ⋯ menu / page button) | Result |
|---|---|---|
| Lead | Convert to client · Schedule site visit · Prepare BOQ | Client / site visit / BOQ pre-filled |
| Site visit | Prepare BOQ / estimate | BOQ linked to client & lead |
| BOQ | Create quotation | Rates include margin, overheads as lump-sum line |
| Quotation | Send → Approve/Reject (client can approve in portal) → New version → Convert to project | Project with contract value = quote total, budget = BOQ cost |
| Material request | Approve → Raise PO | Draft PO at standard rates |
| RFQ | Award to vendor | Draft PO |
| Purchase order | Approve → Receive goods (GRN, partial allowed) → Book purchase invoice | Stock added to site / warehouse, vendor bill |
| Work order | Record measurement | Contractor measurement |
| Measurement | Verify → Generate client invoice / contractor bill | Bill with GST / retention |
| Bill | Record payment / receipt | Balance & status auto-update |

The Lead status advances automatically (Contacted → Site Visit → Estimation → Quoted → Won).

## Modules

Dashboard · Business Flow · Leads · Clients · Site Visits · BOQ/Estimation · Quotations (versions, discount, GST, print/PDF) ·
Projects (360° view with tabs) · Tasks (list + drag-and-drop board, dependencies) · Daily Site Reports (photos) ·
Interior Design (rooms, design images, material & furniture selection, client approval, revision history) · Documents & Photos ·
Material Master · Stock (warehouse + site-wise, receipt / consumption / transfer / wastage, low-stock alerts) · Material Requests ·
RFQ · Purchase Orders · Vendors · Workers · Attendance (daily muster, OT, auto wages) · Subcontractors · Work Orders ·
Measurement Book (L×B×H) · Bills & Invoices (client / vendor / contractor) · Payments · Expenses · 13 Reports (CSV export / print) ·
Notifications (live: task, payment, stock, deadline, approval, purchase, follow-up) · Users & Roles · Settings (company letterhead).

Extras: Ctrl+K command palette, dark mode, mobile responsive layout, role-based menus and API permissions,
portal scoping (clients see only their projects/quotes/bills; contractors only their work orders/bills; workers only their tasks).

## Project structure

```
server/src
  config/        permissions.js (role → module matrix), constants.js (enums)
  models/        sales, project, inventory, workforce, finance (+ auto codes like PRJ-0001)
  routes/        one file per domain; workflow endpoints live next to their resource
  services/      finance roll-up (P/L per project), stock levels, portal scoping
  utils/crud.js  generic list/search/filter/paginate/CRUD factory with hooks
client/src
  config/resources.jsx   columns, forms, filters and workflow actions for every module
  components/data/       ResourcePage, ResourceForm, DataTable, RefSelect, PrintDocument
  pages/                 Dashboard, ProjectDetail, QuotationView, Stock, Attendance, Interior, Reports…
```

Adding a simple module = a Mongoose model + one `crud()` line + one config object.
