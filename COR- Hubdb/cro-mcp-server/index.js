require('dotenv').config();
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');
const Groq  = require('groq-sdk');

// Groq client — LLM recommendations ke liye
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

// Saari rows fetch karo — pagination ke saath
// Note: HubDB v3 mein column filter kaam nahi karta
// Isliye saari rows fetch karke JS mein filter karte hain
async function fetchExperiments(filters) {
  filters = filters || {};
  try {
    var params = { limit: 200 };
    var allRows = [];
    var after   = null;

    // Saari rows fetch karo pages mein
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

    // Ab JavaScript mein filter karo — HubDB filter kaam nahi karta
    if (filters.brand || filters.status || filters.test_type || filters.page_type || filters.owner) {
      allRows = allRows.filter(function(row) {
        var v = row.values || {};

        function getLabel(field) {
          var val = v[field];
          if (!val) return '';
          if (typeof val === 'object') return (val.label || val.name || '').toLowerCase();
          return String(val).toLowerCase();
        }

        var match = true;
        if (filters.brand     && getLabel('brand').indexOf(filters.brand.toLowerCase()) === -1)     match = false;
        if (filters.status    && getLabel('status').indexOf(filters.status.toLowerCase()) === -1)    match = false;
        if (filters.test_type && getLabel('test_type').indexOf(filters.test_type.toLowerCase()) === -1) match = false;
        if (filters.page_type && getLabel('page_type').indexOf(filters.page_type.toLowerCase()) === -1) match = false;
        if (filters.owner     && getLabel('owner').indexOf(filters.owner.toLowerCase()) === -1)     match = false;
        return match;
      });
    }

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
    best_practice_outcome: getText('best_practice_outcome'),
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
    ,
    {
      name: 'recommend_experiment',
      description: 'AI se CRO experiment recommendation lo. Past successful experiments dekh ke best hypothesis suggest karta hai.',
      inputSchema: {
        type: 'object',
        properties: {
          page_type: { type: 'string', description: 'Kis page ke liye experiment chahiye e.g. Demo/Landing Page' },
          brand:     { type: 'string', description: 'Brand name e.g. Bottle POS' },
          goal:      { type: 'string', description: 'Kya improve karna hai e.g. conversion rate badhana, bounce rate kam karna' },
        },
        required: ['page_type', 'goal']
      }
    }
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
      var limit = args.limit || 20;
      var exps  = rows.slice(0, limit).map(formatExperiment);

      if (exps.length === 0) {
        return { content: [{ type: 'text', text: 'Koi experiment nahi mila.' }] };
      }

      // Status emoji helper
      function statusEmoji(s) {
        var sl = s.toLowerCase();
        if (sl === 'success') return 'SUCCESS';
        if (sl === 'failed' || sl === 'fail') return 'FAILED';
        if (sl === 'inconclusive') return 'INCONCLUSIVE';
        return 'ACTIVE';
      }

      var text = 'Total ' + rows.length + ' experiments mile. ' + exps.length + ' dikh rahe hain:\n\n';

      // Markdown table header — HubSpot page jaisa
      text += '| Brand | Landing Page | Test Type | Page Type | Owner | Set Date | Review Date | Status |\n';
      text += '|-------|--------------|-----------|-----------|-------|----------|-------------|--------|\n';

      // Har experiment ek row
      exps.forEach(function(e) {
        var brand       = e.brand.substring(0, 15);
        var page        = e.landing_page.substring(0, 25);
        var testType    = e.test_type.substring(0, 15);
        var pageType    = e.page_type.substring(0, 18);
        var owner       = e.owner.substring(0, 10);
        var setDate     = e.set_date;
        var reviewDate  = e.review_date;
        var status      = statusEmoji(e.status);
        text += '| ' + brand + ' | ' + page + ' | ' + testType + ' | ' + pageType + ' | ' + owner + ' | ' + setDate + ' | ' + reviewDate + ' | ' + status + ' |\n';
      });

      // Results neeche detail mein
      var withResults = exps.filter(function(e) { return e.results && e.results !== '\u2014'; });
      if (withResults.length > 0) {
        text += '\n---\n**Results Detail:**\n\n';
        withResults.forEach(function(e, i) {
          text += (i+1) + '. **' + e.brand + '** — ' + e.landing_page + '\\n';
          text += '   ' + e.results.substring(0, 150) + '\n\n';
        });
      }

      return { content: [{ type: 'text', text: text }] };
    }

        // TOOL 2: search_experiments
    if (name === 'search_experiments') {
      var allRows  = await fetchExperiments();
      var all      = allRows.map(formatExperiment);
      var filtered = all.filter(function(e) { return matchesSearch(e, args.query); });
      var slimit   = args.limit || 15;
      var found    = filtered.slice(0, slimit);

      if (found.length === 0) {
        return { content: [{ type: 'text', text: '"' + args.query + '" ke liye koi experiment nahi mila.' }] };
      }

      var stext = '"' + args.query + '" ke liye ' + found.length + ' experiments mile (total matched: ' + filtered.length + '):\n\n';

      // Markdown table
      stext += '| Brand | Landing Page | Test Type | Page Type | Owner | Set Date | Status |\n';
      stext += '|-------|--------------|-----------|-----------|-------|----------|--------|\n';
      found.forEach(function(e) {
        stext += '| ' + e.brand.substring(0,15) + ' | ' + e.landing_page.substring(0,25) + ' | ' + e.test_type.substring(0,15) + ' | ' + e.page_type.substring(0,18) + ' | ' + e.owner.substring(0,10) + ' | ' + e.set_date + ' | ' + e.status + ' |\n';
      });

      // Changes + Results detail
      stext += '\n---\n**Changes & Results Detail:**\n\n';
      found.forEach(function(e, i) {
        stext += (i+1) + '. **' + e.brand + '** — ' + e.landing_page + '\\n';
        if (e.changes && e.changes !== '\u2014') {
          stext += '   Changes: ' + e.changes.substring(0, 100) + '\\n';
        }
        if (e.results && e.results !== '\u2014') {
          stext += '   Results: ' + e.results.substring(0, 150) + '\\n';
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
        var aO = order[a.status.toLowerCase()] !== undefined ? order[a.status.toLowerCase()] : 3;
        var bO = order[b.status.toLowerCase()] !== undefined ? order[b.status.toLowerCase()] : 3;
        return aO - bO;
      });

      var successCount = simAll.filter(function(e) { return e.status.toLowerCase() === 'success'; }).length;
      var failCount    = simAll.filter(function(e) { return e.status.toLowerCase() === 'failed' || e.status.toLowerCase() === 'fail'; }).length;

      var simText = simAll.length + ' similar experiments mile | Success: ' + successCount + ' | Failed: ' + failCount + '\n\n';

      // Markdown table — success pehle
      simText += '| Brand | Landing Page | Test Type | Owner | Set Date | Status |\n';
      simText += '|-------|--------------|-----------|-------|----------|--------|\n';
      simAll.slice(0, 10).forEach(function(e) {
        simText += '| ' + e.brand.substring(0,15) + ' | ' + e.landing_page.substring(0,25) + ' | ' + e.test_type.substring(0,15) + ' | ' + e.owner.substring(0,10) + ' | ' + e.set_date + ' | ' + e.status + ' |\n';
      });

      // Results detail
      var withRes = simAll.slice(0,10).filter(function(e) { return e.results && e.results !== '\u2014'; });
      if (withRes.length > 0) {
        simText += '\n---\n**Results Detail:**\n\n';
        withRes.forEach(function(e, i) {
          simText += (i+1) + '. **' + e.brand + '** [' + e.status + '] — ' + e.landing_page + '\\n';
          simText += '   ' + e.results.substring(0, 150) + '\n\n';
        });
      }

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
      statsText += 'Total Experiments : ' + statAll.length + '\\n';
      statsText += 'Success           : ' + (statusCount['success'] || 0) + '\\n';
      statsText += 'Failed            : ' + ((statusCount['failed'] || 0) + (statusCount['fail'] || 0)) + '\\n';
      statsText += 'Inconclusive      : ' + (statusCount['inconclusive'] || 0) + '\\n';
      statsText += 'Active/Blank      : ' + (statAll.length - (statusCount['success']||0) - (statusCount['failed']||0) - (statusCount['fail']||0) - (statusCount['inconclusive']||0)) + '\\n';
      statsText += 'Success Rate      : ' + successRate + '%\n\n';
      statsText += 'Top Brands:\n';
      topBrands.forEach(function(b) { statsText += '  - ' + b[0] + ': ' + b[1] + ' experiments\n'; });
      statsText += '\nTop Test Types:\n';
      topTests.forEach(function(t) { statsText += '  - ' + t[0] + ': ' + t[1] + ' experiments\n'; });

      return { content: [{ type: 'text', text: statsText }] };
    }

    // TOOL 5: create_experiment
    if (name === 'create_experiment') {

      // Valid values — agar galat value aayi toh error dikhao
      var validBrands    = ['Bottle POS','IT Retail','Jewel360','MarktPOS','ThriftCart','MusicShop360','eTailPet','CigarsPOS','CellSmart','GrazeCart','LifeSaver','Rain POS','LikeSew','DiveShop360','POS Nation'];
      var validPageTypes = ['Demo/Landing Page','Product Page','Home Page','About/Team Page','Blog','Graphic CTA','Case Study/Testimonial Page','Email'];
      var validTestTypes = ['CTA Type','Color Theory','Copy/CTA Text','Email','Form','Graphics','Layout/Design','Navigation','PLG','Social Proof'];
      var validOwners    = ['Brigi','Dylan','Graham','Megan','Rhett','Richard'];

      // Page type name map — label se HubDB name
      var pageTypeNameMap = {
        'demo/landing page': 'demolanding_page',
        'product page': 'product_page',
        'home page': 'home_page',
        'about/team page': 'aboutteam_page',
        'blog': 'blog',
        'graphic cta': 'graphic_cta',
        'case study/testimonial page': 'case_studytestimonial_page',
        'email': 'email'
      };

      // Test type name map
      var testTypeNameMap = {
        'cta type': 'cta_type',
        'color theory': 'color_theory',
        'copy/cta text': 'copycta_text',
        'email': 'email',
        'form': 'form',
        'graphics': 'graphics',
        'layout/design': 'layoutdesign',
        'navigation': 'navigation',
        'plg': 'plg',
        'social proof': 'social_proof'
      };

      // Validate fields
      var brandLower    = (args.brand || '').toLowerCase();
      var pageTypeLower = (args.page_type || '').toLowerCase();
      var testTypeLower = (args.test_type || '').toLowerCase();
      var ownerLower    = (args.owner || '').toLowerCase();

      if (!validBrands.some(function(b) { return b.toLowerCase() === brandLower; })) {
        return { content: [{ type: 'text', text: 'Brand valid nahi hai. Valid brands: ' + validBrands.join(', ') }] };
      }
      if (!pageTypeNameMap[pageTypeLower]) {
        return { content: [{ type: 'text', text: 'Page Type valid nahi hai. Valid types: ' + validPageTypes.join(', ') }] };
      }
      if (!testTypeNameMap[testTypeLower]) {
        return { content: [{ type: 'text', text: 'Test Type valid nahi hai. Valid types: ' + validTestTypes.join(', ') }] };
      }
      if (!validOwners.some(function(o) { return o.toLowerCase() === ownerLower; })) {
        return { content: [{ type: 'text', text: 'Owner valid nahi hai. Valid owners: ' + validOwners.join(', ') }] };
      }

      // Payload — name+type format use karo
      // Faida: agar HubDB mein column add/delete ho toh ID hardcode nahi karni
      var payload = {
        values: {
          brand:        { name: args.brand,                          type: 'option' },
          landing_page: args.landing_page,
          changes:      args.changes || '',
          page_type:    { name: pageTypeNameMap[pageTypeLower],      type: 'option' },
          test_type:    { name: testTypeNameMap[testTypeLower],      type: 'option' },
          hypothesis:   args.hypothesis,
          owner:        { name: ownerLower,                          type: 'option' },
          status:       { name: 'active',                            type: 'option' },
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
          text: 'Experiment successfully add ho gaya!\nRow ID: ' + createResp.data.id + '\nBrand: ' + args.brand + ' | Page: ' + args.landing_page + ' | Test Type: ' + args.test_type + ' | Owner: ' + args.owner + ' | Status: Active'
        }]
      };
    }

        // TOOL 6: recommend_experiment
    if (name === 'recommend_experiment') {

      // Step 1 — HubDB se similar past experiments fetch karo
      var recRows = await fetchExperiments({ page_type: args.page_type });
      var recAll  = recRows.map(formatExperiment);

      if (args.brand) {
        recAll = recAll.filter(function(e) {
          return e.brand.toLowerCase().indexOf(args.brand.toLowerCase()) !== -1;
        });
      }

      // Sirf results wale ya successful experiments
      var relevant = recAll.filter(function(e) {
        return e.results !== '\u2014' || e.status.toLowerCase() === 'success';
      }).slice(0, 20);

      if (relevant.length === 0) {
        relevant = recAll.slice(0, 15);
      }

      // Step 2 — Past experiments summary
      var lines = [];
      relevant.forEach(function(e, i) {
        lines.push(
          (i+1) + '. Brand: ' + e.brand +
          ' | Page: ' + e.landing_page +
          ' | Test: ' + e.test_type +
          ' | Status: ' + e.status +
          ' | Changes: ' + e.changes +
          ' | Results: ' + e.results.substring(0, 100)
        );
      });
      var pastData = lines.join('\n');

      // Step 3 — Groq AI prompt
      var promptLines = [
        'You are a CRO (Conversion Rate Optimization) expert.',
        'A team wants to improve ' + args.goal + ' on their ' + args.page_type + '.',
        args.brand ? 'Brand: ' + args.brand + '.' : '',
        '',
        'Here are ' + relevant.length + ' past experiments run on similar pages:',
        '',
        pastData,
        '',
        'Based on these past experiments, provide:',
        '1. TOP 3 recommended experiments to run (with reasoning based on past data)',
        '2. For each recommendation:',
        '   - What to test (Changes)',
        '   - Test Type (must be one of: CTA Type, Color Theory, Copy/CTA Text, Graphics, Layout/Design, Social Proof, PLG, Form, Navigation)',
        '   - Ready-made Hypothesis (format: By doing X, I expect Y to improve by Z% in N days)',
        '   - Expected impact based on similar past experiments',
        '3. Which experiments to AVOID (already tested, failed)',
        '',
        'Be specific and data-driven. Keep response concise.'
      ];
      var prompt = promptLines.join('\n');

      // Step 4 — Groq call
      var aiResponse = await groq.chat.completions.create({
        model: 'llama3-70b-8192',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7
      });

      var recommendation = aiResponse.choices[0].message.content;

      // Step 5 — Result
      var resultLines = [
        'AI CRO Recommendations for ' + args.page_type + (args.brand ? ' (' + args.brand + ')' : ''),
        'Goal: ' + args.goal,
        'Based on ' + relevant.length + ' past experiments',
        '',
        '---',
        '',
        recommendation
      ];

      return { content: [{ type: 'text', text: resultLines.join('\n') }] };
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