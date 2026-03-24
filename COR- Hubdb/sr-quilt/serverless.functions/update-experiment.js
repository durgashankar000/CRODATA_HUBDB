const axios = require('axios');

const BASE_URL = 'https://api.hubapi.com';

const REQUIRED_FIELDS = [
    'brand',
    'landing_page',
    'page_type',
    'test_type',
    'changes',
    'hypothesis',
    'owner',
    'set_date'
];

function normalizeColumnOptions(options) {
    if (!options) return [];
    if (Array.isArray(options)) return options;
    if (typeof options === 'object') {
        return Object.keys(options)
            .map((k) => {
                const o = options[k];
                if (!o || typeof o !== 'object') return null;
                return {
                    id: o.id != null ? String(o.id) : String(k),
                    name: o.name != null ? String(o.name) : '',
                    label: o.label != null ? String(o.label) : ''
                };
            })
            .filter(Boolean);
    }
    return [];
}

function resolveSelectOption(column, raw) {
    if (!column || raw == null || String(raw).trim() === '') return null;
    const s = String(raw).trim();
    const opts = normalizeColumnOptions(column.options);
    let opt = opts.find((o) => o.id === s);
    if (!opt) opt = opts.find((o) => o.name === s);
    if (!opt) opt = opts.find((o) => String(o.name).toLowerCase() === s.toLowerCase());
    if (!opt) opt = opts.find((o) => o.label === s);
    if (!opt) opt = opts.find((o) => String(o.label).toLowerCase() === s.toLowerCase());
    if (!opt || !opt.name) return null;
    return { type: 'option', name: opt.name };
}

function columnsToMap(columns) {
    const map = {};
    (columns || []).forEach((col) => {
        if (col && col.name) map[col.name] = col;
    });
    return map;
}

async function fetchColumnsByName(client, tableId) {
    const encoded = encodeURIComponent(String(tableId).trim());
    const tryPaths = [`/cms/v3/hubdb/tables/${encoded}`, `/cms/v3/hubdb/tables/${encoded}/draft`];
    let lastErr = null;
    for (const path of tryPaths) {
        try {
            const { data } = await client.get(path);
            const cols = data.columns || [];
            if (cols.length) return columnsToMap(cols);
        } catch (e) {
            lastErr = e;
        }
    }
    const status = lastErr && lastErr.response && lastErr.response.status;
    const hint =
        status === 404
            ? ` Table "${tableId}" not found — use the numeric table ID from HubDB (or publish the table).`
            : '';
    throw new Error(
        ((lastErr && lastErr.response && lastErr.response.data && lastErr.response.data.message) ||
            (lastErr && lastErr.message) ||
            'Could not load HubDB table columns') + hint
    );
}

const SELECT_FIELD_NAMES = ['brand', 'page_type', 'test_type', 'owner', 'status'];

async function buildRowValuesWithResolvedSelects(client, tableId, data) {
    let columnsByName;
    try {
        columnsByName = await fetchColumnsByName(client, tableId);
    } catch (e) {
        return {
            values: null,
            error: 'Could not load HubDB table schema: ' + ((e.response && e.response.data && e.response.data.message) || e.message)
        };
    }

    const str = (v) => (v != null ? String(v).trim() : '');
    const dateToTimestamp = (v) => {
        if (v == null || String(v).trim() === '') return null;
        const s = String(v).trim();
        const d = new Date(s.includes('T') ? s : s + 'T00:00:00.000Z');
        return Number.isFinite(d.getTime()) ? d.getTime() : null;
    };

    const values = {
        landing_page: str(data.landing_page) || '',
        changes: str(data.changes) || '',
        url: str(data.url) || '',
        hypothesis: str(data.hypothesis) || '',
        set_date: dateToTimestamp(data.set_date),
        review_date: dateToTimestamp(data.review_date),
        results: str(data.results) || ''
    };

    for (const field of SELECT_FIELD_NAMES) {
        const raw = data[field];
        if (field === 'status' && (raw == null || String(raw).trim() === '')) {
            values[field] = null;
            continue;
        }
        if (raw == null || String(raw).trim() === '') {
            return { values: null, error: `Missing value for select column: ${field}` };
        }
        const col = columnsByName[field];
        const resolved = resolveSelectOption(col, raw);
        if (!resolved) {
            return {
                values: null,
                error: `Invalid option value for the column \`${field}\` (submitted: "${String(raw).slice(0, 80)}"). Publish the HubDB table and confirm option ids/names.`
            };
        }
        values[field] = resolved;
    }

    return { values, error: null };
}

function resolveTableId(data) {
    const fromBody =
        data &&
        (data.hubdbTableId != null && String(data.hubdbTableId).trim() !== ''
            ? String(data.hubdbTableId).trim()
            : data.tableId != null && String(data.tableId).trim() !== ''
              ? String(data.tableId).trim()
              : '');
    const fromEnv = process.env.HUBDB_TABLE_ID != null && String(process.env.HUBDB_TABLE_ID).trim() !== ''
        ? String(process.env.HUBDB_TABLE_ID).trim()
        : '';
    return fromBody || fromEnv || '';
}

exports.main = async (context, sendResponse) => {
    const accessToken = process.env.MARKETPOS_HUBDB_ACCESS_TOKEN || process.env.PRIVATE_APP_ACCESS_TOKEN;

    if (!accessToken) {
        sendResponse({
            body: { success: false, message: 'Server configuration error: access token not set.' },
            statusCode: 500
        });
        return;
    }

    let data = context.body;
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (e) {
            sendResponse({
                body: { success: false, message: 'Invalid JSON body.' },
                statusCode: 400
            });
            return;
        }
    }

    if (!data || typeof data !== 'object') {
        sendResponse({
            body: { success: false, message: 'Request body must be a JSON object.' },
            statusCode: 400
        });
        return;
    }

    const rowId = data.rowId;
    if (rowId == null || String(rowId).trim() === '') {
        sendResponse({
            body: { success: false, message: 'Missing rowId.' },
            statusCode: 400
        });
        return;
    }

    const missing = REQUIRED_FIELDS.filter((key) => {
        const val = data[key];
        return val === undefined || val === null || String(val).trim() === '';
    });

    if (missing.length > 0) {
        sendResponse({
            body: { success: false, message: 'Missing required fields: ' + missing.join(', ') },
            statusCode: 400
        });
        return;
    }

    const tableId = resolveTableId(data);
    if (!tableId) {
        sendResponse({
            body: {
                success: false,
                message:
                    'Missing HubDB table id: add hubdbTableId from the module (data-table-id) or set HUBDB_TABLE_ID on the serverless function.'
            },
            statusCode: 400
        });
        return;
    }

    const client = axios.create({
        baseURL: BASE_URL,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });

    try {
        const { values, error } = await buildRowValuesWithResolvedSelects(client, tableId, data);
        if (error) {
            sendResponse({
                body: { success: false, message: error },
                statusCode: 400
            });
            return;
        }

        const encodedTable = encodeURIComponent(String(tableId).trim());
        const encodedRow = encodeURIComponent(String(rowId).trim());
        await client.patch(`/cms/v3/hubdb/tables/${encodedTable}/rows/${encodedRow}/draft`, { values });
        sendResponse({
            body: { success: true },
            statusCode: 200
        });
    } catch (err) {
        const status = err.response && err.response.status;
        const d = err.response && err.response.data;
        let message = (d && d.message) || err.message || 'Failed to update HubDB row.';
        if (d && Array.isArray(d.errors) && d.errors.length) {
            const parts = d.errors.map((e) => (e && e.message) || JSON.stringify(e)).filter(Boolean);
            if (parts.length) message = parts.join('; ');
        }
        sendResponse({
            body: { success: false, message },
            statusCode: status || 500
        });
    }
};
