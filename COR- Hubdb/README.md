# Experiment Dashboard (HubSpot CMS + HubDB)

This project creates an Experiment Management Dashboard inside HubSpot
using HubDB, a custom CMS module, and a serverless endpoint.\
The dashboard allows users to create, view, search, and manage A/B
testing experiments.

------------------------------------------------------------------------

# 1. Project Structure

    experiment-dashboard/
    │
    ├── modules/
    │   └── experiment-dashboard.module/
    │       ├── fields.json
    │       ├── module.html
    │       ├── module.css
    │       └── module.js
    │
    ├── serverless/
    │   └── createExperiment.js
    │
    └── README.md

------------------------------------------------------------------------

# 2. HubDB Table

Create a HubDB table named:

    experiments

Columns:

  Column          Type
  --------------- ----------
  brand           text
  landing_page    text
  page_type       text
  test_type       text
  changes         richtext
  url             text
  hypothesis      richtext
  owner           text
  status          select
  set_date        date
  review_date     date
  results         richtext
  outcome         text

Example Status Options: - Active - Success - Failed - Pending

------------------------------------------------------------------------

# 3. CMS Module

Create a HubSpot CMS module with a HubDB table selector.

fields.json

``` json
[
  {
    "name": "hubdb_table",
    "label": "Select Experiment Table",
    "type": "hubdbtable",
    "required": true
  }
]
```

------------------------------------------------------------------------

# 4. Dashboard Layout

Sidebar navigation:

-   ◈ Dashboard
-   ⊞ All Experiments
-   ＋ New Experiment

Dashboard should display:

Top Cards - Total Experiments - Success - Failed

Recent Experiments Table

| Brand \| Test Title \| Test Type \| Page Type \| Owner \| Set Date
  \| Status \|

------------------------------------------------------------------------

# 5. All Experiments Page

Filters:

-   Search
-   Filter by Brand Name
-   Filter by Page Type
-   Filter by Test Type
-   Filter by Status

Table shows experiment records with pagination.

Pagination: - 10 experiments per page

------------------------------------------------------------------------

# 6. New Experiment Form

Fields:

-   Brand \*
-   Test Title (`landing_page`) \*
-   Page Type \*
-   Test Type \*
-   Changes / What are you testing? \*
-   URL
-   Hypothesis \*
-   Owner \*
-   Status
-   Set Date \*
-   Review Date
-   Results
-   Outcome

Fields marked \* are required.

------------------------------------------------------------------------

# 7. Serverless Endpoint

Endpoint name:

    createExperiment

Form submits data to the endpoint which:

1.  Validates required fields
2.  Creates a HubDB row
3.  Returns success response

------------------------------------------------------------------------

# 8. Example Serverless Function

``` javascript
const hubspot = require('@hubspot/api-client');

exports.main = async (context, sendResponse) => {

  const client = new hubspot.Client({
    accessToken: process.env.PRIVATE_APP_ACCESS_TOKEN
  });

  const data = context.body;
  const tableId = process.env.HUBDB_TABLE_ID;

  await client.cms.hubdb.rowsApi.createRow(tableId,{
    values:{
      brand:data.brand,
      landing_page:data.landing_page,
      page_type:data.page_type,
      test_type:data.test_type,
      changes:data.changes,
      url:data.url,
      hypothesis:data.hypothesis,
      owner:data.owner,
      status:data.status,
      set_date:data.set_date,
      review_date:data.review_date,
      results:data.results,
      outcome:data.outcome
    }
  });

  sendResponse({
    body:{ success:true },
    statusCode:200
  });

};
```

------------------------------------------------------------------------

# 9. Environment Variables

Configure in HubSpot serverless:

    PRIVATE_APP_ACCESS_TOKEN
    HUBDB_TABLE_ID

------------------------------------------------------------------------

# 10. Deployment

Deploy with HubSpot CLI:

    hs project upload

------------------------------------------------------------------------

# Features

-   Dashboard statistics
-   Recent experiment list
-   Experiment search and filters
-   Pagination
-   Experiment creation form
-   HubDB storage
-   Serverless API integration
