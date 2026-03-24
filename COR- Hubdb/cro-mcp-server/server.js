// ============================================================
// CRO Tracker — HTTP API Server
// HubDB se data fetch karta hai + Groq AI recommendations
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Groq = require('groq-sdk');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// ─── Config ──────────────────────────────────────────────────
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBDB_TABLE_ID = process.env.HUBDB_TABLE_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const groq = new Groq({ apiKey: GROQ_API_KEY });

const hubspotClient = axios.create({
    baseURL: 'https://api.hubapi.com',
    headers: {
        'Authorization': 'Bearer ' + HUBSPOT_API_KEY,
        'Content-Type': 'application/json'
    }
});

// ─── HubDB se saari rows fetch karo ─────────────────────────
async function fetchAllRows() {
    var allRows = [];
    var after = null;
    var params = { limit: 200 };

    do {
        if (after) params.after = after;
        var response = await hubspotClient.get(
            '/cms/v3/hubdb/tables/' + HUBDB_TABLE_ID + '/rows',
            { params: params }
        );
        allRows = allRows.concat(response.data.results || []);
        after = (response.data.paging && response.data.paging.next)
            ? response.data.paging.next.after
            : null;
    } while (after);

    return allRows;
}

// ─── Row format karo ────────────────────────────────────────
function formatRow(row) {
    var v = row.values || {};

    function getOption(field) {
        var val = v[field];
        if (!val) return '';
        if (typeof val === 'object') return val.label || val.name || '';
        return String(val);
    }

    function getText(field) {
        var val = v[field];
        if (!val) return '';
        return String(val);
    }

    function getDate(field) {
        var val = v[field];
        if (!val) return '';
        return new Date(val).toLocaleDateString('en-IN');
    }

    return {
        id: row.id,
        brand: getOption('brand'),
        landing_page: getText('landing_page'),
        changes: getText('changes'),
        page_type: getOption('page_type'),
        test_type: getOption('test_type'),
        set_date: getDate('set_date'),
        review_date: getDate('review_date'),
        hypothesis: getText('hypothesis'),
        results: getText('results'),
        owner: getOption('owner'),
        status: getOption('status'),
    };
}

// ============================================================
// API ROUTES
// ============================================================

// Health check
app.get('/', function (req, res) {
    res.json({ status: 'CRO Tracker API running!', version: '1.0.0' });
});

// ─── GET /stats — saare experiments ka summary ───────────────
app.get('/stats', async function (req, res) {
    try {
        var rows = await fetchAllRows();
        var all = rows.map(formatRow);

        var statusCount = {};
        all.forEach(function (e) {
            var s = (e.status || 'active').toLowerCase();
            statusCount[s] = (statusCount[s] || 0) + 1;
        });

        var brandCount = {};
        all.forEach(function (e) {
            if (e.brand) brandCount[e.brand] = (brandCount[e.brand] || 0) + 1;
        });

        var testCount = {};
        all.forEach(function (e) {
            if (e.test_type) testCount[e.test_type] = (testCount[e.test_type] || 0) + 1;
        });

        var topBrands = Object.entries(brandCount).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
        var topTests = Object.entries(testCount).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);

        res.json({
            total: all.length,
            success: statusCount['success'] || 0,
            failed: (statusCount['failed'] || 0) + (statusCount['fail'] || 0),
            inconclusive: statusCount['inconclusive'] || 0,
            active: statusCount['active'] || 0,
            successRate: ((statusCount['success'] || 0) / all.length * 100).toFixed(1) + '%',
            topBrands: topBrands.map(function (b) { return { name: b[0], count: b[1] }; }),
            topTestTypes: topTests.map(function (t) { return { name: t[0], count: t[1] }; }),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /experiments — list with filters ───────────────────
app.get('/experiments', async function (req, res) {
    try {
        var rows = await fetchAllRows();
        var all = rows.map(formatRow);

        // JS mein filter karo
        if (req.query.brand) {
            all = all.filter(function (e) {
                return e.brand.toLowerCase().indexOf(req.query.brand.toLowerCase()) !== -1;
            });
        }
        if (req.query.page_type) {
            all = all.filter(function (e) {
                return e.page_type.toLowerCase().indexOf(req.query.page_type.toLowerCase()) !== -1;
            });
        }
        if (req.query.test_type) {
            all = all.filter(function (e) {
                return e.test_type.toLowerCase().indexOf(req.query.test_type.toLowerCase()) !== -1;
            });
        }
        if (req.query.status) {
            all = all.filter(function (e) {
                return e.status.toLowerCase().indexOf(req.query.status.toLowerCase()) !== -1;
            });
        }
        if (req.query.owner) {
            all = all.filter(function (e) {
                return e.owner.toLowerCase().indexOf(req.query.owner.toLowerCase()) !== -1;
            });
        }

        var limit = parseInt(req.query.limit) || 20;
        res.json({
            total: all.length,
            results: all.slice(0, limit)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /search — text search ──────────────────────────────
app.get('/search', async function (req, res) {
    try {
        var query = (req.query.q || '').toLowerCase();
        if (!query) return res.json({ total: 0, results: [] });

        var rows = await fetchAllRows();
        var all = rows.map(formatRow);

        var found = all.filter(function (e) {
            return (
                e.brand.toLowerCase().indexOf(query) !== -1 ||
                e.landing_page.toLowerCase().indexOf(query) !== -1 ||
                e.changes.toLowerCase().indexOf(query) !== -1 ||
                e.hypothesis.toLowerCase().indexOf(query) !== -1 ||
                e.test_type.toLowerCase().indexOf(query) !== -1 ||
                e.results.toLowerCase().indexOf(query) !== -1
            );
        });

        var limit = parseInt(req.query.limit) || 10;
        res.json({
            total: found.length,
            query: query,
            results: found.slice(0, limit)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /recommend — AI se recommendation lo ───────────────
app.post('/recommend', async function (req, res) {
    try {
        var page_type = req.body.page_type || '';
        var brand = req.body.brand || '';
        var goal = req.body.goal || '';

        if (!page_type || !goal) {
            return res.status(400).json({ error: 'page_type aur goal required hain' });
        }

        // Past experiments fetch karo
        var rows = await fetchAllRows();
        var all = rows.map(formatRow);

        // Page type filter
        var relevant = all.filter(function (e) {
            return e.page_type.toLowerCase().indexOf(page_type.toLowerCase()) !== -1;
        });

        // Brand filter optional
        if (brand) {
            var brandFiltered = relevant.filter(function (e) {
                return e.brand.toLowerCase().indexOf(brand.toLowerCase()) !== -1;
            });
            if (brandFiltered.length > 5) relevant = brandFiltered;
        }

        // Results wale pehle
        var withResults = relevant.filter(function (e) { return e.results; });
        var sample = withResults.length > 0 ? withResults.slice(0, 20) : relevant.slice(0, 20);

        // Past data summary
        var pastData = sample.map(function (e, i) {
            return (i + 1) + '. Brand: ' + e.brand +
                ' | Test: ' + e.test_type +
                ' | Status: ' + e.status +
                ' | Changes: ' + e.changes +
                ' | Results: ' + e.results.substring(0, 100);
        }).join('\n');

        // Groq AI prompt
        var promptLines = [
            'You are a CRO (Conversion Rate Optimization) expert.',
            'Goal: ' + goal + ' on ' + page_type + (brand ? ' for ' + brand : '') + '.',
            '',
            'Past experiments (' + sample.length + '):',
            pastData,
            '',
            'Provide TOP 3 experiment recommendations:',
            '1. What to test (Changes)',
            '2. Test Type (CTA Type/Copy/CTA Text/Layout/Design/Social Proof/Graphics/PLG/Form/Navigation)',
            '3. Hypothesis (By doing X, I expect Y to improve by Z% in N days)',
            '4. Why (based on past data)',
            '',
            'Also mention 1-2 experiments to AVOID (already failed).',
            'Be concise and data-driven. Respond in Hindi/English mix.'
        ];

        var aiResponse = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: promptLines.join('\n') }],
            max_tokens: 1000,
            temperature: 0.7
        });

        res.json({
            page_type: page_type,
            brand: brand,
            goal: goal,
            experiments_used: sample.length,
            recommendation: aiResponse.choices[0].message.content
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /experiments — naya experiment add karo ────────────
app.post('/experiments', async function (req, res) {
    try {
        var brandMap = {
            'bottle pos': 13, 'it retail': 14, 'jewel360': 15, 'marktpos': 16,
            'thriftcart': 17, 'musicshop360': 18, 'etailpet': 19, 'cigarspos': 20,
            'cellsmart': 21, 'grazecart': 22, 'lifesaver': 23, 'rain pos': 24,
            'likesew': 25, 'diveshop360': 26, 'pos nation': 27
        };
        var pageTypeMap = {
            'demo/landing page': 'demolanding_page', 'product page': 'product_page',
            'home page': 'home_page', 'about/team page': 'aboutteam_page',
            'blog': 'blog', 'graphic cta': 'graphic_cta',
            'case study/testimonial page': 'case_studytestimonial_page', 'email': 'email'
        };
        var testTypeMap = {
            'cta type': 'cta_type', 'color theory': 'color_theory',
            'copy/cta text': 'copycta_text', 'email': 'email', 'form': 'form',
            'graphics': 'graphics', 'layout/design': 'layoutdesign',
            'navigation': 'navigation', 'plg': 'plg', 'social proof': 'social_proof'
        };
        var ownerMap = {
            'brigi': 'brigi', 'dylan': 'dylan', 'graham': 'graham',
            'megan': 'megan', 'rhett': 'rhett', 'richard': 'richard'
        };

        var b = (req.body.brand || '').toLowerCase();
        var p = (req.body.page_type || '').toLowerCase();
        var t = (req.body.test_type || '').toLowerCase();
        var o = (req.body.owner || '').toLowerCase();

        if (!brandMap[b]) return res.status(400).json({ error: 'Invalid brand: ' + req.body.brand });
        if (!pageTypeMap[p]) return res.status(400).json({ error: 'Invalid page_type: ' + req.body.page_type });
        if (!testTypeMap[t]) return res.status(400).json({ error: 'Invalid test_type: ' + req.body.test_type });
        if (!ownerMap[o]) return res.status(400).json({ error: 'Invalid owner: ' + req.body.owner });

        var payload = {
            values: {
                brand: { name: req.body.brand, type: 'option' },
                landing_page: req.body.landing_page,
                changes: req.body.changes || '',
                page_type: { name: pageTypeMap[p], type: 'option' },
                test_type: { name: testTypeMap[t], type: 'option' },
                hypothesis: req.body.hypothesis,
                owner: { name: o, type: 'option' },
                status: { name: 'active', type: 'option' },
                set_date: new Date(req.body.set_date).getTime(),
                review_date: req.body.review_date ? new Date(req.body.review_date).getTime() : null,
            }
        };

        var createResp = await hubspotClient.post(
            '/cms/v3/hubdb/tables/' + HUBDB_TABLE_ID + '/rows',
            payload
        );

        await hubspotClient.post(
            '/cms/v3/hubdb/tables/' + HUBDB_TABLE_ID + '/draft/publish'
        );

        res.json({
            success: true,
            id: createResp.data.id,
            message: 'Experiment add ho gaya!'
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Server Start ─────────────────────────────────────────────
app.listen(port, function () {
    console.log('CRO Tracker API Server running on http://localhost:' + port);
    console.log('Routes:');
    console.log('  GET  /stats          — Summary stats');
    console.log('  GET  /experiments    — List with filters');
    console.log('  GET  /search?q=xxx   — Text search');
    console.log('  POST /recommend      — AI recommendation');
    console.log('  POST /experiments    — Add new experiment');
});