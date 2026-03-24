// ============================================================
// CRO Test Tracker — MCP Server (Final Working Version)
// Endpoint: cms/v3/hubdb — 398 rows confirmed working
// ============================================================

require('dotenv').config();
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');


const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBDB_TABLE_ID  = process.env.HUBDB_TABLE_ID;

if (!HUBSPOT_API_KEY || !HUBDB_TABLE_ID) {
  console.error('ERROR: .env file mein HUBSPOT_API_KEY aur HUBDB_TABLE_ID chahiye!');
  process.exit(1);
}


const hubspotClient = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    'Authorization': 'Bearer ' + HUBSPOT_API_KEY,
    'Content-Type': 'application/json'
  }
});

// ─── HubDB se Data Fetch Karo (Pagination ke saath) ─────────
// HubDB ek baar mein max 200 rows deta hai
// Saari rows laane ke liye baar baar request karte hain
async function fetchExperiments(filters) {
  filters = filters || {};
  try {
    var params = { limit: 200 };
    if (filters.brand)     params['values[brand]']     = filters.brand;
    if (filters.status)    params['values[status]']    = filters.status;
    if (filters.test_type) params['values[test_type]'] = filters.test_type;
    if (filters.page_type) params['values[page_type]'] = filters.page_type;
    if (filters.owner)     params['values[owner]']     = filters.owner;

    var allRows = [];
    var after   = null;

    do {
      if (after) params.after = after;
      var response = await hubspotClient.get(
        '/cms/v3/hubdb/tables/' + HUBDB_TABLE_ID + '/rows',
        { params: params }
      );
      var results = response.data.results || [];
      allRows = allRows.concat(results);
      after = (response.data.paging && response.data.paging.next) ? response.data.paging.next.after : null;
    } while (after);

    return allRows;
  } catch (error) {
    var status  = error.response ? error.response.status : 'unknown';
    var message = (error.response && error.response.data) ? error.response.data.message : error.message;
    throw new Error('HubDB Error ' + status + ': ' + message);
  }
}

// Row ko readable format mein badlo
function formatExperiment(row) {
  var v = row.values || {};

  function getOption(field) {
    var val = v[field];
    if (!val) return '—';
    if (typeof val === 'object') return val.label || val.name || '—';
    return String(val);
  }

  function getText(field) {
    var val = v[field];
    if (!val) return '—';
    return String(val);
  }

  function getDate(field) {
    var val = v[field];
    if (!val) return '—';
    return new Date(val).toLocaleDateString('en-IN');
  }

  return {
    id:                    row.id || '—',
    brand:                 getOption('brand'),
    landing_page:          getText('landing_page'),
    page_url:              getText('url'),
    changes:               getText('changes'),
    page_type:             getOption('page_type'),
    test_type:             getOption('test_type'),
    set_date:              getDate('set_date'),
    review_date:           getDate('review_date'),
    hypothesis:            getText('hypothesis'),
    results:               getText('results'),
    owner:                 getOption('owner'),
    status:                getOption('status'),
  };
}

// Text search
function matchesSearch(exp, query) {
  var q = query.toLowerCase();
  return (
    exp.brand.toLowerCase().indexOf(q) !== -1        ||
    exp.landing_page.toLowerCase().indexOf(q) !== -1 ||
    exp.changes.toLowerCase().indexOf(q) !== -1      ||
    exp.hypothesis.toLowerCase().indexOf(q) !== -1   ||
    exp.test_type.toLowerCase().indexOf(q) !== -1    ||
    exp.page_type.toLowerCase().indexOf(q) !== -1    ||
    exp.results.toLowerCase().indexOf(q) !== -1
  );
}

// MCP Server
var server = new Server(
  { name: 'cro-tracker-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Tools list
server.setRequestHandler(ListToolsRequestSchema, async function() {
  return {
    tools: [
      {
        name: 'list_experiments',
        description: 'HubDB se CRO experiments fetch karo. Brand, status, test_type, page_type, owner se filter kar sakte ho.',
        inputSchema: {
          type: 'object',
          properties: {
            brand:     { type: 'string', description: 'Brand name e.g. Bottle POS' },
            status:    { type: 'string', description: 'Active, Success, Failed, Inconclusive' },
            test_type: { type: 'string', description: 'Copy/CTA Text, Layout/Design, Social Proof, PLG, etc.' },
            page_type: { type: 'string', description: 'Demo/Landing Page, Home Page, Product Page, Blog, Email' },
            owner:     { type: 'string', description: 'Owner name e.g. Megan' },
            limit:     { type: 'number', description: 'Kitne results chahiye default 15' },
          }
        }
      },
      {
        name: 'search_experiments',
        description: 'Experiments mein free text search karo.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query e.g. video testimonial demo page' },
            limit: { type: 'number', description: 'Kitne results chahiye default 10' },
          },
          required: ['query']
        }
      },
      {
        name: 'find_similar_experiments',
        description: 'Similar past experiments dhundho — duplicate avoid karne ke liye.',
        inputSchema: {
          type: 'object',
          properties: {
            page_type: { type: 'string', description: 'Page type e.g. Demo/Landing Page' },
            test_type: { type: 'string', description: 'Test type e.g. Social Proof' },
            brand:     { type: 'string', description: 'Brand name optional' },
          },
          required: ['page_type']
        }
      },
      {
        name: 'get_experiment_stats',
        description: 'CRO experiments ka summary — total, success rate, top brands, test types.',
        inputSchema: {
          type: 'object',
          properties: {
            brand: { type: 'string', description: 'Specific brand ka stats optional' },
          }
        }
      },
      {
        name: 'create_experiment',
        description: 'HubDB mein naya CRO experiment add karo.',
        inputSchema: {
          type: 'object',
          properties: {
            brand:        { type: 'string', description: 'Brand name' },
            landing_page: { type: 'string', description: 'Page name' },
            changes:      { type: 'string', description: 'Kya change kiya' },
            page_type:    { type: 'string', description: 'Page type' },
            test_type:    { type: 'string', description: 'Test type' },
            hypothesis:   { type: 'string', description: 'Full hypothesis text' },
            owner:        { type: 'string', description: 'Owner name' },
            set_date:     { type: 'string', description: 'Start date YYYY-MM-DD' },
            review_date:  { type: 'string', description: 'Review date YYYY-MM-DD optional' },
          },
          required: ['brand', 'landing_page', 'page_type', 'test_type', 'hypothesis', 'owner', 'set_date']
        }
      },
    ]
  };
});

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async function(request) {
  var name = request.params.name;
  var args = request.params.arguments || {};

  try {

    // TOOL 1: list_experiments
    if (name === 'list_experiments') {
      var rows  = await fetchExperiments(args);
      var limit = args.limit || 15;
      var exps  = rows.slice(0, limit).map(formatExperiment);

      if (exps.length === 0) {
        return { content: [{ type: 'text', text: 'Koi experiment nahi mila.' }] };
      }

      var text = 'Total ' + rows.length + ' experiments mile. Top ' + exps.length + ' dikh rahe hain:\n\n';
      exps.forEach(function(e, i) {
        text += (i + 1) + '. Brand: ' + e.brand + '\n';
        text += '   Page: ' + e.landing_page + '\n';
        text += '   Status: ' + e.status + '\n';
        text += '   Test Type: ' + e.test_type + '\n';
        text += '   Page Type: ' + e.page_type + '\n';
        text += '   Owner: ' + e.owner + '\n';
        text += '   Date: ' + e.set_date + '\n';
        text += '   Changes: ' + e.changes + '\n';
        if (e.results && e.results !== '—') {
          text += '   Results: ' + e.results.substring(0, 100) + '\n';
        }
        text += '\n';
      });

      return { content: [{ type: 'text', text: text }] };
    }

    // TOOL 2: search_experiments
    if (name === 'search_experiments') {
      var allRows   = await fetchExperiments();
      var all       = allRows.map(formatExperiment);
      var filtered  = all.filter(function(e) { return matchesSearch(e, args.query); });
      var slimit    = args.limit || 10;
      var found     = filtered.slice(0, slimit);

      if (found.length === 0) {
        return { content: [{ type: 'text', text: '"' + args.query + '" ke liye koi experiment nahi mila.' }] };
      }

      var stext = '"' + args.query + '" ke liye ' + found.length + ' experiments mile:\n\n';
      found.forEach(function(e, i) {
        stext += (i + 1) + '. Brand: ' + e.brand + '\n';
        stext += '   Page: ' + e.landing_page + ' — Status: ' + e.status + '\n';
        stext += '   Test: ' + e.test_type + ' | Page Type: ' + e.page_type + '\n';
        stext += '   Changes: ' + e.changes + '\n';
        if (e.results && e.results !== '—') {
          stext += '   Results: ' + e.results.substring(0, 150) + '\n';
        }
        stext += '\n';
      });

      return { content: [{ type: 'text', text: stext }] };
    }

    // TOOL 3: find_similar_experiments
    if (name === 'find_similar_experiments') {
      var simRows = await fetchExperiments({ page_type: args.page_type });
      var simAll  = simRows.map(formatExperiment);

      if (args.test_type) {
        simAll = simAll.filter(function(e) {
          return e.test_type.toLowerCase().indexOf(args.test_type.toLowerCase()) !== -1;
        });
      }
      if (args.brand) {
        simAll = simAll.filter(function(e) {
          return e.brand.toLowerCase().indexOf(args.brand.toLowerCase()) !== -1;
        });
      }

      if (simAll.length === 0) {
        return { content: [{ type: 'text', text: 'Koi similar experiment nahi mila — yeh naya test hoga!' }] };
      }

      var order = { 'success': 0, 'inconclusive': 1, 'failed': 2, 'active': 3 };
      simAll.sort(function(a, b) {
        var aOrder = order[a.status.toLowerCase()] !== undefined ? order[a.status.toLowerCase()] : 3;
        var bOrder = order[b.status.toLowerCase()] !== undefined ? order[b.status.toLowerCase()] : 3;
        return aOrder - bOrder;
      });

      var successCount = simAll.filter(function(e) { return e.status.toLowerCase() === 'success'; }).length;
      var failCount    = simAll.filter(function(e) { return e.status.toLowerCase() === 'failed' || e.status.toLowerCase() === 'fail'; }).length;

      var simText = simAll.length + ' similar experiments mile. Success: ' + successCount + ' | Failed: ' + failCount + '\n\n';
      simAll.slice(0, 8).forEach(function(e, i) {
        simText += (i + 1) + '. [' + e.status.toUpperCase() + '] ' + e.brand + ' — ' + e.landing_page + '\n';
        simText += '   Test: ' + e.test_type + ' | Owner: ' + e.owner + ' | Date: ' + e.set_date + '\n';
        simText += '   Changes: ' + e.changes + '\n';
        if (e.results && e.results !== '—') {
          simText += '   Result: ' + e.results.substring(0, 150) + '\n';
        }
        simText += '\n';
      });

      return { content: [{ type: 'text', text: simText }] };
    }

    // TOOL 4: get_experiment_stats
    if (name === 'get_experiment_stats') {
      var statRows = await fetchExperiments(args.brand ? { brand: args.brand } : {});
      var statAll  = statRows.map(formatExperiment);

      if (statAll.length === 0) {
        return { content: [{ type: 'text', text: 'Koi data nahi mila.' }] };
      }

      var statusCount = {};
      statAll.forEach(function(e) {
        var s = (e.status || 'active').toLowerCase();
        statusCount[s] = (statusCount[s] || 0) + 1;
      });

      var brandCount = {};
      statAll.forEach(function(e) {
        brandCount[e.brand] = (brandCount[e.brand] || 0) + 1;
      });
      var topBrands = Object.keys(brandCount)
        .map(function(b) { return [b, brandCount[b]]; })
        .sort(function(a, b) { return b[1] - a[1]; })
        .slice(0, 5);

      var testCount = {};
      statAll.forEach(function(e) {
        testCount[e.test_type] = (testCount[e.test_type] || 0) + 1;
      });
      var topTests = Object.keys(testCount)
        .map(function(t) { return [t, testCount[t]]; })
        .sort(function(a, b) { return b[1] - a[1]; })
        .slice(0, 5);

      var successRate = ((statusCount['success'] || 0) / statAll.length * 100).toFixed(1);

      var statsText = 'CRO Stats' + (args.brand ? ' — ' + args.brand : '') + ':\n\n';
      statsText += 'Total Experiments : ' + statAll.length + '\n';
      statsText += 'Success           : ' + (statusCount['success'] || 0) + '\n';
      statsText += 'Failed            : ' + ((statusCount['failed'] || 0) + (statusCount['fail'] || 0)) + '\n';
      statsText += 'Inconclusive      : ' + (statusCount['inconclusive'] || 0) + '\n';
      statsText += 'Active/Blank      : ' + (statAll.length - (statusCount['success']||0) - (statusCount['failed']||0) - (statusCount['fail']||0) - (statusCount['inconclusive']||0)) + '\n';
      statsText += 'Success Rate      : ' + successRate + '%\n\n';
      statsText += 'Top Brands:\n';
      topBrands.forEach(function(b) { statsText += '  - ' + b[0] + ': ' + b[1] + ' experiments\n'; });
      statsText += '\nTop Test Types:\n';
      topTests.forEach(function(t) { statsText += '  - ' + t[0] + ': ' + t[1] + ' experiments\n'; });

      return { content: [{ type: 'text', text: statsText }] };
    }

    // TOOL 5: create_experiment
    if (name === 'create_experiment') {
      var payload = {
        values: {
          brand:        args.brand,
          landing_page: args.landing_page,
          changes:      args.changes     || '',
          page_type:    args.page_type,
          test_type:    args.test_type,
          hypothesis:   args.hypothesis,
          owner:        args.owner,
          status:       'Active',
          set_date:     new Date(args.set_date).getTime(),
          review_date:  args.review_date ? new Date(args.review_date).getTime() : null,
        }
      };

      var createResp = await hubspotClient.post(
        '/cms/v3/hubdb/tables/' + HUBDB_TABLE_ID + '/rows',
        payload
      );

      await hubspotClient.post(
        '/cms/v3/hubdb/tables/' + HUBDB_TABLE_ID + '/draft/publish'
      );

      return {
        content: [{
          type: 'text',
          text: 'Experiment add ho gaya! ID: ' + createResp.data.id + ' | Brand: ' + args.brand + ' | Page: ' + args.landing_page + ' | Owner: ' + args.owner
        }]
      };
    }

    return { content: [{ type: 'text', text: 'Unknown tool: ' + name }] };

  } catch (error) {
    return {
      content: [{ type: 'text', text: 'Error: ' + error.message }],
      isError: true
    };
  }
});

// Server start
async function main() {
  var transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CRO MCP Server running — ready!');
}

main().catch(console.error);