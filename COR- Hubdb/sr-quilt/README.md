# Experiment Dashboard (HubSpot CMS + HubDB)

This project provides an Experiment Management Dashboard for HubSpot using HubDB, a custom CMS module, and a serverless endpoint. Create, view, search, and manage A/B testing experiments.

## Project structure

```
experiment-dashboard/
├── .functions/                    ← serverless (Design Manager)
│   ├── serverless.json
│   └── createExperiment.js
├── modules/
│   └── experiment-dashboard.module/
│       ├── fields.json
│       ├── module.html
│       ├── module.css
│       └── module.js
└── README.md
```

## 1. HubDB table

Create a HubDB table named **experiments** with these columns:

| Column        | Type     |
|---------------|----------|
| brand         | text     |
| landing_page  | text     |
| page_type     | text     |
| test_type     | text     |
| changes       | richtext |
| url           | text     |
| hypothesis    | richtext |
| owner         | text     |
| status        | select   |
| set_date      | date     |
| review_date   | date     |
| results       | richtext |
| outcome       | text     |

*HubDB label for `landing_page` is often shown as **Test Title** in the UI.*

**Status options:** Active, Success, Failed, Pending.

## 2. Environment variables (serverless)

In HubSpot, configure these for the serverless function:

- `PRIVATE_APP_ACCESS_TOKEN` – Private app token with HubDB (and CMS) scopes.
- `HUBDB_TABLE_ID` – ID of the **experiments** HubDB table (from the table URL or HubDB dashboard).

## 3. CMS module setup

1. Add the **Experiment Dashboard** module to a page.
2. In the module settings, select the **experiments** HubDB table.

## 4. Dashboard features

- **Sidebar:** Dashboard, All Experiments, New Experiment.
- **Dashboard:** Total / Success / Failed counts and recent experiments table.
- **All Experiments:** Search, filters (Brand, Page Type, Test Type, Status), table with **10 per page** pagination.
- **New Experiment:** Form with required fields (*) that submits to the `createExperiment` serverless endpoint.

## 5. Serverless endpoint: createExperiment

- **Name:** `createExperiment`
- **Behavior:**
  1. Validates required fields (brand, landing_page, page_type, test_type, changes, hypothesis, owner, set_date).
  2. Creates a row in the HubDB table.
  3. Returns `{ success: true }` on success, or `{ success: false, message: "..." }` with an appropriate status code on error.

## 6. Deployment

Upload via Design Manager (from the `COR- Hubdb` folder):

```bash
hs cms upload .\experiment-dashboard\ .\experiment-dashboard\
```

Serverless lives in **`.functions`** (required by HubSpot Design Manager).

## Features summary

- Dashboard statistics (total, success, failed)
- Recent experiment list
- Search and filters (brand, page type, test type, status)
- Pagination (10 experiments per page)
- New experiment form
- HubDB storage
- Serverless API for creating experiments
