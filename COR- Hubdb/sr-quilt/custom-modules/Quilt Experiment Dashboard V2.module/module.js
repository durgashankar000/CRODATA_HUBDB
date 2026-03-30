(function () {
  'use strict';

  const RAW = window.__EXPERIMENT_DASHBOARD_DATA__ || [];

  /** Fallback when live HubDB column JSON is missing or unusable (must match table in HubSpot). */
  const FALLBACK_SELECT_COLUMNS = [
    { name: 'brand', label: 'Brand', type: 'SELECT', options: [{ id: '13', name: 'Bottle POS', label: 'Bottle POS', type: 'option' }, { id: '14', name: 'IT Retail', label: 'IT Retail', type: 'option' }, { id: '15', name: 'Jewel360', label: 'Jewel360', type: 'option' }, { id: '16', name: 'MarktPOS', label: 'MarktPOS', type: 'option' }, { id: '17', name: 'ThriftCart', label: 'ThriftCart', type: 'option' }, { id: '18', name: 'MusicShop360', label: 'MusicShop360', type: 'option' }, { id: '19', name: 'eTailPet', label: 'eTailPet', type: 'option' }, { id: '20', name: 'CigarsPOS', label: 'CigarsPOS', type: 'option' }, { id: '21', name: 'CellSmart', label: 'CellSmart', type: 'option' }, { id: '22', name: 'GrazeCart', label: 'GrazeCart', type: 'option' }, { id: '23', name: 'LifeSaver', label: 'LifeSaver', type: 'option' }, { id: '24', name: 'Rain POS', label: 'Rain POS', type: 'option' }, { id: '25', name: 'LikeSew', label: 'LikeSew', type: 'option' }, { id: '26', name: 'DiveShop360', label: 'DiveShop360', type: 'option' }, { id: '27', name: 'POS Nation', label: 'POS Nation', type: 'option' }, { id: '28', name: 'Q1 2025', label: 'Q1 2025', type: 'option' }] },
    { name: 'page_type', label: 'Page Type', type: 'SELECT', options: [{ id: '2', name: 'demolanding_page', label: 'Demo/Landing Page', type: 'option' }, { id: '3', name: 'product_page', label: 'Product Page', type: 'option' }, { id: '4', name: 'home_page', label: 'Home Page', type: 'option' }, { id: '5', name: 'about_team_page', label: 'About/Team Page', type: 'option' }, { id: '6', name: 'blog', label: 'Blog', type: 'option' }, { id: '7', name: 'graphic_cta', label: 'Graphic CTA', type: 'option' }, { id: '8', name: 'case_studytestimonial_page', label: 'Case Study/Testimonial Page', type: 'option' }, { id: '9', name: 'email', label: 'Email', type: 'option' }] },
    { name: 'test_type', label: 'Test Type', type: 'SELECT', options: [{ id: '8', name: 'social_proof', label: 'Social Proof', type: 'option' }, { id: '9', name: 'plg', label: 'PLG', type: 'option' }, { id: '10', name: 'copycta_text', label: 'Copy/CTA Text', type: 'option' }, { id: '11', name: 'graphics', label: 'Graphics', type: 'option' }, { id: '12', name: 'layoutdesign', label: 'Layout/Design', type: 'option' }, { id: '13', name: 'cta_type', label: 'CTA Type', type: 'option' }, { id: '14', name: 'color_theory', label: 'Color Theory', type: 'option' }, { id: '15', name: 'navigation', label: 'Navigation', type: 'option' }, { id: '16', name: 'form', label: 'Form', type: 'option' }, { id: '17', name: 'email', label: 'Email', type: 'option' }] },
    { name: 'owner', label: 'Owner', type: 'SELECT', options: [{ id: '2', name: 'brigi', label: 'Brigi', type: 'option' }, { id: '3', name: 'dylan', label: 'Dylan', type: 'option' }, { id: '4', name: 'graham', label: 'Graham', type: 'option' }, { id: '5', name: 'megan', label: 'Megan', type: 'option' }, { id: '6', name: 'rhett', label: 'Rhett', type: 'option' }, { id: '7', name: 'richard', label: 'Richard', type: 'option' }] },
    { name: 'status', label: 'Status', type: 'SELECT', options: [{ id: '2', name: 'active', label: 'Active', type: 'option' }, { id: '3', name: 'success', label: 'Success', type: 'option' }, { id: '4', name: 'failed', label: 'Failed', type: 'option' }, { id: '5', name: 'pending', label: 'Pending', type: 'option' }, { id: '6', name: 'Inconclusive', label: 'Inconclusive', type: 'option' }] }
  ];

  const REQUIRED_FORM_SELECT_KEYS = ['brand', 'page_type', 'test_type', 'owner', 'status'];

  /** HubDB often serializes options as an object map (id → option), not an array. */
  function normalizeOptions(raw) {
    if (raw == null) return [];
    if (Array.isArray(raw)) {
      return raw
        .map((opt) => {
          if (!opt || typeof opt !== 'object') return null;
          const name = opt.name != null ? String(opt.name) : '';
          const label = opt.label != null ? String(opt.label) : name;
          if (!name && !label) return null;
          return {
            id: opt.id != null ? String(opt.id) : '',
            name: name || label,
            label: label || name,
            type: 'option'
          };
        })
        .filter(Boolean);
    }
    if (typeof raw === 'object') {
      return Object.keys(raw)
        .map((k) => {
          const o = raw[k];
          if (!o || typeof o !== 'object') return null;
          const name = o.name != null ? String(o.name) : '';
          const label = o.label != null ? String(o.label) : name;
          if (!name && !label) return null;
          return {
            id: String(o.id != null ? o.id : k),
            name: name || label,
            label: label || name,
            type: 'option'
          };
        })
        .filter(Boolean);
    }
    return [];
  }

  function normalizeTableColumnsFromHubL(raw) {
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw
      .map((c) => {
        if (!c || typeof c !== 'object') return null;
        const type = String(c.type || '').toUpperCase();
        const opts = normalizeOptions(c.options);
        if (opts.length === 0) return null;
        if (type && type !== 'SELECT') return null;
        return {
          name: c.name,
          label: c.label || c.name,
          type: 'SELECT',
          options: opts
        };
      })
      .filter(Boolean);
  }

  function isSelectMetaUsable(cols) {
    return REQUIRED_FORM_SELECT_KEYS.every((key) => {
      const c = cols.find((x) => x && x.name === key);
      return c && Array.isArray(c.options) && c.options.length > 0;
    });
  }

  const _normalizedFormColumns = normalizeTableColumnsFromHubL(window.__HUBDB_FORM_SELECT_COLUMNS__);
  const _normalizedHubMeta = normalizeTableColumnsFromHubL(window.__HUBDB_TABLE_COLUMNS__);

  /** When the form uses the explicit HubL column list, extra SELECT columns (e.g. business_unit) still come from full table meta. */
  function mergeSelectColumnsFromHubMeta(base, hubMeta) {
    if (!Array.isArray(base)) return [];
    if (!Array.isArray(hubMeta)) return base;
    const seen = new Set(base.map((c) => (c && c.name ? c.name : '')));
    const merged = [...base];
    hubMeta.forEach((c) => {
      if (!c || !c.name || seen.has(c.name)) return;
      if (!Array.isArray(c.options) || c.options.length === 0) return;
      merged.push(c);
      seen.add(c.name);
    });
    return merged;
  }

  let TABLE_COLUMNS = isSelectMetaUsable(_normalizedFormColumns)
    ? _normalizedFormColumns
    : isSelectMetaUsable(_normalizedHubMeta)
      ? _normalizedHubMeta
      : FALLBACK_SELECT_COLUMNS;

  TABLE_COLUMNS = mergeSelectColumnsFromHubMeta(TABLE_COLUMNS, _normalizedHubMeta);

  /**
   * HubDB row id for API (update/delete) — must be hs_id / hs_object_id.
   * Do NOT use row.id on flat HubL rows: a custom HubDB column named "id" (NUMBER) uses that key and breaks PATCH.
   * For REST-shaped rows { id, values }, top-level id is the HubDB row id (custom id lives in values).
   */
  function getRowId(row) {
    if (!row) return '';
    if (row.hs_id != null) return String(row.hs_id);
    if (row.hs_object_id != null) return String(row.hs_object_id);
    if (row.values != null && typeof row.values === 'object' && row.id != null) {
      return String(row.id);
    }
    return '';
  }
  const DATA = RAW.filter((row) => getRowId(row) !== '');

  const PER_PAGE = 10;

  let currentPage = 1;
  let filteredData = [];
  let editingRowId = null;
  /** Which list is shown on the dashboard home area: all recent, active-only, or pending-only. */
  let dashboardListMode = 'all';

  const DASH_RECENT_LIMIT = 15;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const EDIT_SVG = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';

  const DELETE_SVG = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path></svg>';

  /* ------------------------------
  Helpers
  ------------------------------ */

  function getCellDisplay(row, key) {
    const v = row[key];
    if (v == null) return '';
    if (typeof v === 'object') {
      if (v.label) return String(v.label);
      if (v.name) return String(v.name);
    }
    return String(v);
  }

  function getRowOptionName(row, key) {
    const v = row[key];
    if (v == null) return '';
    if (typeof v === 'object' && v.name != null) return String(v.name);
    return String(v);
  }

  /** HubDB rows use ms timestamps; after an in-memory update, dates may be YYYY-MM-DD strings from the form. */
  function formatDateForInput(val) {
    if (val == null || val === '') return '';
    let d;
    if (typeof val === 'number' && Number.isFinite(val)) {
      d = new Date(val);
    } else if (typeof val === 'string') {
      const s = val.trim();
      if (!s) return '';
      const asNum = Number(s);
      if (Number.isFinite(asNum) && !/e/i.test(s) && /^-?\d+(\.\d+)?$/.test(s.replace(/^\+/, ''))) {
        d = new Date(asNum);
      } else {
        d = new Date(s.includes('T') ? s : s + 'T00:00:00.000Z');
      }
    } else {
      d = new Date(Number(val));
    }
    if (!Number.isFinite(d.getTime())) return '';
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function formatDate(val) {
    if (!val) return '—';
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toLocaleDateString();
    return String(val);
  }

  function statusClass(status) {
    const map = {
      active: ' active',
      success: ' success',
      failed: ' failed',
      pending: ' pending',
      inconclusive: ' inconclusive'
    };
    return map[String(status).toLowerCase()] || '';
  }

  /** Sidebar global scope: lowercase label, empty = all. */
  function getSidebarBusinessUnitFilter() {
    return ($('#sidebar-filter-business-unit')?.value || '').toLowerCase().trim();
  }

  function matchesSidebarBusinessUnit(row) {
    const g = getSidebarBusinessUnitFilter();
    if (!g) return true;
    return row._business_unit === g;
  }

  function getGloballyScopedNormalizedRows() {
    return NORMALIZED_DATA.filter(matchesSidebarBusinessUnit);
  }

  function refreshGlobalScopeViews() {
    renderStats();
    renderDashboardRecent(dashboardListMode);
    applyFilters();
  }

  /* ------------------------------
  Normalize Data
  ------------------------------ */

  let NORMALIZED_DATA = DATA.map((row) => ({
    ...row,
    _brand: getCellDisplay(row, 'brand').toLowerCase(),
    _page_type: getCellDisplay(row, 'page_type').toLowerCase(),
    _test_type: getCellDisplay(row, 'test_type').toLowerCase(),
    _owner: getCellDisplay(row, 'owner').toLowerCase(),
    _business_unit: getCellDisplay(row, 'business_unit').toLowerCase(),
    _status: getCellDisplay(row, 'status').toLowerCase(),
    _search: [
      getCellDisplay(row, 'brand'),
      getCellDisplay(row, 'landing_page'),
      getCellDisplay(row, 'page_type'),
      getCellDisplay(row, 'test_type'),
      getCellDisplay(row, 'owner'),
      getCellDisplay(row, 'business_unit'),
      row.hypothesis ?? '',
      row.changes ?? ''
    ].join(' ').toLowerCase()
  }));

  filteredData = [...NORMALIZED_DATA];

  /* ------------------------------
  Row Builder
  ------------------------------ */

  function buildRow(row) {

    const esc = escapeHtml;
    const cell = (k) => esc(getCellDisplay(row, k));
    const status = getCellDisplay(row, 'status') || '—';
    const id = getRowId(row);

    return `
<tr data-row-id="${id}">
<td><span class="brand-pill">${cell('brand')}</span></td>
<td>${cell('landing_page')}</td>
<td>${cell('test_type')}</td>
<td>${cell('page_type')}</td>
<td>${cell('owner')}</td>
<td>${cell('business_unit')}</td>
<td>${formatDate(row.set_date)}</td>
<td>${formatDate(row.review_date)}</td>
<td class="cell-long-text">${cell('results')}</td>
<td><span class="status-badge${statusClass(status)}">${esc(status)}</span></td>
<td class="actions-cell">
<button type="button" class="action-btn btn-edit" data-row-id="${id}" title="Edit" aria-label="Edit">${EDIT_SVG}</button>
<button type="button" class="action-btn btn-delete" data-row-id="${id}" title="Delete" aria-label="Delete">${DELETE_SVG}</button>
</td>
</tr>
`;
  }

  /* ------------------------------
  Stats
  ------------------------------ */

  function renderStats() {

    const scoped = getGloballyScopedNormalizedRows();
    const total = scoped.length;
    const success = scoped.filter(r => r._status === 'success').length;
    const failed = scoped.filter(r => r._status === 'failed').length;

    const setStat = (id, n) => {
      const el = $('#' + id);
      if (el) el.textContent = n;
    };
    setStat('stat-total', total);
    setStat('stat-success', success);
    setStat('stat-failed', failed);

  }

  function getRowSortTime(row) {
    if (row.hs_created_at != null && Number.isFinite(Number(row.hs_created_at))) return Number(row.hs_created_at);
    if (row.hs_updated_at != null && Number.isFinite(Number(row.hs_updated_at))) return Number(row.hs_updated_at);
    const sd = row.set_date;
    if (sd != null) {
      if (typeof sd === 'number' && Number.isFinite(sd)) return sd;
      const t = new Date(sd).getTime();
      if (Number.isFinite(t)) return t;
    }
    return 0;
  }

  function dashboardListTitle(mode) {
    if (mode === 'active') return 'Recent active experiments';
    if (mode === 'pending') return 'Recent pending experiments';
    return 'Recent experiments';
  }

  function renderDashboardRecent(mode) {
    dashboardListMode = mode;
    const tbody = $('#dashboard-recent-body');
    const titleEl = $('#dashboard-section-title');
    if (titleEl) titleEl.textContent = dashboardListTitle(mode);
    if (!tbody) return;

    let list = [...getGloballyScopedNormalizedRows()];
    if (mode === 'active') list = list.filter((r) => r._status === 'active');
    else if (mode === 'pending') list = list.filter((r) => r._status === 'pending');

    list.sort((a, b) => getRowSortTime(b) - getRowSortTime(a));
    list = list.slice(0, DASH_RECENT_LIMIT);

    let emptyMsg = 'No experiments yet.';
    if (mode === 'active') emptyMsg = 'No active experiments.';
    else if (mode === 'pending') emptyMsg = 'No pending experiments.';

    tbody.innerHTML = list.length
      ? list.map(buildRow).join('')
      : `<tr><td colspan="11">${escapeHtml(emptyMsg)}</td></tr>`;
  }

  /* ------------------------------
  All Table
  ------------------------------ */

  function renderAllTable() {

    const tbody = $('#all-experiments-body');
    if (!tbody) return;

    const start = (currentPage - 1) * PER_PAGE;
    const slice = filteredData.slice(start, start + PER_PAGE);

    tbody.innerHTML = slice.length
      ? slice.map(buildRow).join('')
      : '<tr><td colspan="11">No experiments match your filters.</td></tr>';

  }

  /* ------------------------------
  Pagination
  ------------------------------ */

  function renderPagination() {

    const container = $('#pagination');
    if (!container) return;

    const total = filteredData.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

    container.innerHTML = '';

    const prev = document.createElement('button');
    prev.textContent = 'Previous';
    prev.disabled = currentPage <= 1;
    prev.onclick = () => {
      currentPage--;
      renderAllTable();
      renderPagination();
    };

    const next = document.createElement('button');
    next.textContent = 'Next';
    next.disabled = currentPage >= totalPages;
    next.onclick = () => {
      currentPage++;
      renderAllTable();
      renderPagination();
    };

    const info = document.createElement('span');
    info.textContent = `Page ${currentPage} of ${totalPages}`;

    container.append(prev, info, next);

  }

  /* ------------------------------
  Unique values & dropdown options
  ------------------------------ */

  function getUniqueValues(key) {
    const set = new Set();
    DATA.forEach((row) => {
      const val = getCellDisplay(row, key);
      if (val && String(val).trim()) set.add(String(val).trim());
    });
    return [...set].sort();
  }

  function getSelectColumn(name) {
    return TABLE_COLUMNS.find((c) => c && c.name === name);
  }

  /** Option value stored in <select> — prefer HubDB option id (API-safe); else internal name. */
  function getOptionFormValue(opt) {
    if (!opt || typeof opt !== 'object') return '';
    if (opt.id != null && String(opt.id).trim() !== '') return String(opt.id);
    if (opt.name != null && String(opt.name).trim() !== '') return String(opt.name);
    return opt.label != null ? String(opt.label) : '';
  }

  /** Match submitted form value (option id or name/label) back to column option. */
  function findSelectOptionMatch(col, rawVal) {
    if (!col || !Array.isArray(col.options) || rawVal == null || String(rawVal).trim() === '') return null;
    const v = String(rawVal).trim();
    return (
      col.options.find((o) => String(o.id) === v) ||
      col.options.find((o) => o.name === v) ||
      col.options.find((o) => o.label === v) ||
      col.options.find((o) => String(o.name).toLowerCase() === v.toLowerCase()) ||
      col.options.find((o) => String(o.label).toLowerCase() === v.toLowerCase())
    );
  }

  /** When editing, set <select> to option id if row has it (must match fillFormSelectOptions values). */
  function getRowSelectFormValue(row, key) {
    const cell = row[key];
    if (cell != null && typeof cell === 'object' && cell.id != null) {
      return String(cell.id);
    }
    return getRowOptionName(row, key);
  }

  function fillFilterOptions() {
    const filterConfig = [
      { id: 'filter-brand', key: 'brand', allLabel: 'All Brands' },
      { id: 'filter-page-type', key: 'page_type', allLabel: 'All Page Types' },
      { id: 'filter-test-type', key: 'test_type', allLabel: 'All Test Types' },
      { id: 'filter-owner', key: 'owner', allLabel: 'All Owners' },
      { id: 'filter-business-unit', key: 'business_unit', allLabel: 'All Business Units' }
    ];
    filterConfig.forEach(({ id, key, allLabel }) => {
      const sel = $('#' + id);
      if (!sel) return;
      sel.innerHTML = `<option value="">${allLabel}</option>`;
      const col = getSelectColumn(key);
      if (col && Array.isArray(col.options) && col.options.length > 0) {
        col.options.forEach((opt) => {
          const label = opt.label || opt.name;
          sel.add(new Option(label, label));
        });
      } else {
        getUniqueValues(key).forEach((v) => sel.add(new Option(v, v)));
      }
    });
    const sidebarBu = $('#sidebar-filter-business-unit');
    if (sidebarBu) {
      sidebarBu.innerHTML = '<option value="">All business units</option>';
      const colBu = getSelectColumn('business_unit');
      if (colBu && Array.isArray(colBu.options) && colBu.options.length > 0) {
        colBu.options.forEach((opt) => {
          const label = opt.label || opt.name;
          sidebarBu.add(new Option(label, label));
        });
      } else {
        getUniqueValues('business_unit').forEach((v) => sidebarBu.add(new Option(v, v)));
      }
    }
    const statusSel = $('#filter-status');
    if (statusSel) {
      statusSel.innerHTML = '<option value="">All Statuses</option>';
      const statusCol = getSelectColumn('status');
      if (statusCol && Array.isArray(statusCol.options) && statusCol.options.length > 0) {
        statusCol.options.forEach((opt) => {
          const label = opt.label || opt.name;
          statusSel.add(new Option(label, label));
        });
      } else {
        ['Active', 'Success', 'Failed', 'Pending', 'Inconclusive'].forEach((v) => statusSel.add(new Option(v, v)));
      }
    }
  }

  function fillFormSelectOptions() {
    const formSelects = [
      { id: 'field-brand', key: 'brand' },
      { id: 'field-page_type', key: 'page_type' },
      { id: 'field-test_type', key: 'test_type' },
      { id: 'field-owner', key: 'owner' },
      { id: 'field-business_unit', key: 'business_unit' },
      { id: 'field-status', key: 'status' }
    ];
    formSelects.forEach(({ id, key }) => {
      const sel = $('#' + id);
      if (!sel) return;
      const firstOpt = sel.querySelector('option[value=""]');
      const keepFirst = firstOpt ? firstOpt.textContent : '— Select —';
      sel.innerHTML = `<option value="">${keepFirst}</option>`;
      const col = getSelectColumn(key);
      if (col && Array.isArray(col.options) && col.options.length > 0) {
        col.options.forEach((opt) => {
          const label = opt.label || opt.name;
          const value = getOptionFormValue(opt) || label;
          sel.add(new Option(label, value));
        });
      } else {
        getUniqueValues(key).forEach((v) => sel.add(new Option(v, v)));
      }
    });
  }

  /* ------------------------------
  Filters
  ------------------------------ */

  function applyFilters() {

    const search = ($('#filter-search')?.value || '').toLowerCase();
    const brand = $('#filter-brand')?.value.toLowerCase() || '';
    const pageType = $('#filter-page-type')?.value.toLowerCase() || '';
    const testType = $('#filter-test-type')?.value.toLowerCase() || '';
    const owner = $('#filter-owner')?.value.toLowerCase() || '';
    const businessUnit = $('#filter-business-unit')?.value.toLowerCase() || '';
    const status = $('#filter-status')?.value.toLowerCase() || '';
    const dateField = ($('#filter-date-field')?.value || 'set_date').trim();
    const dateStart = ($('#filter-date-start')?.value || '').trim();
    const dateEnd = ($('#filter-date-end')?.value || '').trim();

    filteredData = NORMALIZED_DATA.filter((row) => {

      if (!matchesSidebarBusinessUnit(row)) return false;
      if (brand && row._brand !== brand) return false;
      if (pageType && row._page_type !== pageType) return false;
      if (testType && row._test_type !== testType) return false;
      if (owner && row._owner !== owner) return false;
      if (businessUnit && row._business_unit !== businessUnit) return false;
      if (status && row._status !== status) return false;
      if (search && !row._search.includes(search)) return false;

      if (dateStart || dateEnd) {
        const key = dateField === 'review_date' ? 'review_date' : 'set_date';
        const ymd = formatDateForInput(row[key]);
        if (!ymd) return false;
        if (dateStart && ymd < dateStart) return false;
        if (dateEnd && ymd > dateEnd) return false;
      }

      return true;

    });

    currentPage = 1;

    renderAllTable();
    renderPagination();

  }

  function resetFilters() {
    const searchEl = $('#filter-search');
    if (searchEl) searchEl.value = '';
    ['filter-brand', 'filter-page-type', 'filter-test-type', 'filter-owner', 'filter-business-unit', 'filter-status'].forEach((id) => {
      const el = $('#' + id);
      if (el) el.value = '';
    });
    const dateFieldEl = $('#filter-date-field');
    if (dateFieldEl) dateFieldEl.value = 'set_date';
    const dateStartEl = $('#filter-date-start');
    if (dateStartEl) dateStartEl.value = '';
    const dateEndEl = $('#filter-date-end');
    if (dateEndEl) dateEndEl.value = '';
    applyFilters();
  }

  /* ------------------------------
  Create Experiment (form submit as JSON to avoid 415)
  ------------------------------ */

  const REQUIRED_FIELDS = ['brand', 'landing_page', 'page_type', 'test_type', 'changes', 'hypothesis', 'owner', 'set_date', 'url', 'status'];

  function fillFormFromRow(row) {
    const form = $('#experiment-form');
    if (!form) return;
    const set = (name, value) => {
      const el = form.querySelector('[name="' + name + '"]');
      if (el) el.value = value != null ? String(value) : '';
    };
    const selectKeys = ['brand', 'page_type', 'test_type', 'owner', 'business_unit', 'status'];
    selectKeys.forEach((key) => set(key, getRowSelectFormValue(row, key)));
    set('landing_page', getCellDisplay(row, 'landing_page'));
    set('changes', row.changes != null ? String(row.changes) : '');
    set('url', getCellDisplay(row, 'url'));
    set('hypothesis', row.hypothesis != null ? String(row.hypothesis) : '');
    set('set_date', formatDateForInput(row.set_date));
    set('review_date', formatDateForInput(row.review_date));
    set('results', row.results != null ? String(row.results) : '');
  }

  function setFormEditMode(editing) {
    const titleEl = $('#form-view-title');
    const btnEl = $('#form-submit-btn');
    const cancelBtn = $('#form-cancel-btn');
    const form = $('#experiment-form');
    if (titleEl) titleEl.textContent = editing ? 'Update Experiment' : 'New Experiment';
    if (btnEl) btnEl.textContent = editing ? 'Update Experiment' : 'Create Experiment';
    if (cancelBtn) cancelBtn.hidden = !editing;
    if (!editing) {
      editingRowId = null;
      clearFormMessage();
      if (form) {
        form.reset();
        clearFieldErrors(form);
        fillFormSelectOptions();
      }
    }
  }

  function handleEdit(rowId) {
    const row = DATA.find((r) => getRowId(r) === String(rowId));
    if (!row) return;
    clearFormMessage();
    fillFormSelectOptions();
    fillFormFromRow(row);
    editingRowId = String(rowId);
    switchView('new');
    setFormEditMode(true);
  }

  function clearFieldErrors(form) {
    form.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
  }

  function clearFormMessage() {
    const msg = $('#form-message');
    if (!msg) return;
    msg.textContent = '';
    msg.className = 'form-message';
  }

  function showFieldErrors(form, data) {
    clearFieldErrors(form);
    let hasError = false;
    REQUIRED_FIELDS.forEach((name) => {
      const val = data[name];
      if (!val || !String(val).trim()) {
        const input = form.querySelector('[name="' + name + '"]');
        if (input) {
          const row = input.closest('.form-row');
          const errEl = row ? row.querySelector('.field-error') : null;
          if (errEl) {
            errEl.textContent = 'Please complete this required field.';
            hasError = true;
          }
        }
      }
    });
    return hasError;
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    const form = $('#experiment-form');
    const msg = $('#form-message');
    if (!form || !msg) return;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    clearFieldErrors(form);
    if (showFieldErrors(form, data)) {
      msg.textContent = '';
      msg.className = 'form-message';
      return;
    }

    const isEdit = editingRowId != null && editingRowId !== '';
    msg.textContent = isEdit ? 'Updating...' : 'Creating...';
    msg.className = 'form-message';

    try {
      const dashboard = document.querySelector('.experiment-dashboard');
      const hubdbTableId = dashboard && dashboard.getAttribute('data-table-id');
      const url = isEdit
        ? location.origin + '/_hcms/api/updateExperiment'
        : location.origin + '/_hcms/api/createExperiment';
      const body = isEdit
        ? { rowId: editingRowId, ...(hubdbTableId ? { hubdbTableId } : {}), ...data }
        : { ...(hubdbTableId ? { hubdbTableId } : {}), ...data };
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const responseText = await res.text();
      let json = {};
      try {
        json = responseText ? JSON.parse(responseText) : {};
      } catch (parseErr) {
        json = {};
      }

      function apiErrorMessage() {
        if (json.message) return json.message;
        if (Array.isArray(json.errors) && json.errors.length) {
          const parts = json.errors.map((e) => (e && e.message) || '').filter(Boolean);
          if (parts.length) return parts.join('; ');
        }
        if (responseText && responseText.length < 400 && !responseText.trim().startsWith('<')) {
          return responseText.trim();
        }
        return `Request failed (HTTP ${res.status}). If this persists, redeploy serverless createExperiment (single-file bundle).`;
      }

      if (res.ok && json.success) {
        if (isEdit) {
          const idx = DATA.findIndex((r) => getRowId(r) === String(editingRowId));
          if (idx !== -1) {
            const updated = { ...DATA[idx] };
            Object.keys(data).forEach((k) => {
              const col = getSelectColumn(k);
              if (col && Array.isArray(col.options) && col.options.length > 0 && data[k]) {
                const opt = findSelectOptionMatch(col, data[k]);
                updated[k] = opt ? { name: opt.name, label: opt.label, type: 'option' } : data[k];
              } else if (k === 'set_date' || k === 'review_date') {
                const ds = formatDateForInput(data[k]);
                updated[k] = ds ? new Date(ds + 'T00:00:00.000Z').getTime() : null;
              } else {
                updated[k] = data[k];
              }
            });
            DATA.splice(idx, 1, updated);
          }
          NORMALIZED_DATA = DATA.map((row) => ({
            ...row,
            _brand: getCellDisplay(row, 'brand').toLowerCase(),
            _page_type: getCellDisplay(row, 'page_type').toLowerCase(),
            _test_type: getCellDisplay(row, 'test_type').toLowerCase(),
            _owner: getCellDisplay(row, 'owner').toLowerCase(),
            _business_unit: getCellDisplay(row, 'business_unit').toLowerCase(),
            _status: getCellDisplay(row, 'status').toLowerCase(),
            _search: [
              getCellDisplay(row, 'brand'),
              getCellDisplay(row, 'landing_page'),
              getCellDisplay(row, 'page_type'),
              getCellDisplay(row, 'test_type'),
              getCellDisplay(row, 'owner'),
              getCellDisplay(row, 'business_unit'),
              row.hypothesis ?? '',
              row.changes ?? ''
            ].join(' ').toLowerCase()
          }));
          filteredData = [...NORMALIZED_DATA];
          renderStats();
          renderAllTable();
          renderPagination();
          setFormEditMode(false);
          if (typeof Swal !== 'undefined') {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Experiment updated', showConfirmButton: false, timer: 2500 });
          }
          switchView('dashboard');
          setTimeout(async () => { 
            console.log('handlePublish called edit section');
            await handlePublish(); 
          }, 1200);
        } else {
          form.reset();
          fillFormSelectOptions();
          if (json.row) {
            const r = json.row;
            const flat = r.values && typeof r.values === 'object'
              ? { id: r.id, hs_id: r.id, ...r.values }
              : { ...r };
            if (getRowId(flat) !== '') {
              DATA.unshift(flat);
              NORMALIZED_DATA = DATA.map((row) => ({
                ...row,
                _brand: getCellDisplay(row, 'brand').toLowerCase(),
                _page_type: getCellDisplay(row, 'page_type').toLowerCase(),
                _test_type: getCellDisplay(row, 'test_type').toLowerCase(),
                _owner: getCellDisplay(row, 'owner').toLowerCase(),
                _business_unit: getCellDisplay(row, 'business_unit').toLowerCase(),
                _status: getCellDisplay(row, 'status').toLowerCase(),
                _search: [
                  getCellDisplay(row, 'brand'),
                  getCellDisplay(row, 'landing_page'),
                  getCellDisplay(row, 'page_type'),
                  getCellDisplay(row, 'test_type'),
                  getCellDisplay(row, 'owner'),
                  getCellDisplay(row, 'business_unit'),
                  row.hypothesis ?? '',
                  row.changes ?? ''
                ].join(' ').toLowerCase()
              }));
              filteredData = [...NORMALIZED_DATA];
              currentPage = 1;
              renderStats();
              renderAllTable();
              renderPagination();
            }
          }
          setFormEditMode(false);
          if (typeof Swal !== 'undefined') {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Experiment created', showConfirmButton: false, timer: 2500 });
          }
          switchView('dashboard');
          setTimeout(async () => { 
            console.log('handlePublish called create section');
            await handlePublish(); }, 1200);
        }
      } else {
        msg.textContent = apiErrorMessage() || (isEdit ? 'Update failed' : 'Creation failed');
        msg.className = 'form-message error';
      }
    } catch (err) {
      msg.textContent = 'Network error';
      msg.className = 'form-message error';
    }
  }

  /* ------------------------------
  Delete
  ------------------------------ */

  async function handleDelete(rowId) {
    console.log(rowId);
    if (!rowId) return;
    const result = await Swal.fire({
      title: "Delete experiment?",
      text: "This cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it"
    });
    if (!result.isConfirmed) return;

    try {
      const dashboard = document.querySelector('.experiment-dashboard');
      const hubdbTableId = dashboard && dashboard.getAttribute('data-table-id');
      const res = await fetch(location.origin + '/_hcms/api/deleteExperiment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ rowId: String(rowId), hubdbTableId: hubdbTableId ? String(hubdbTableId) : undefined })
      });
      const json = await res.json();

      console.log(json);

      if (res.ok && json.success) {
        const index = DATA.findIndex((r) => getRowId(r) === String(rowId));
        if (index !== -1) DATA.splice(index, 1);
        NORMALIZED_DATA = NORMALIZED_DATA.filter((r) => getRowId(r) !== String(rowId));
        filteredData = [...NORMALIZED_DATA];
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Experiment deleted', showConfirmButton: false, timer: 2500 });
        renderStats();
        renderDashboardRecent(dashboardListMode);
        applyFilters();
        renderPagination();
        setTimeout(async function() { 
          console.log('handlePublish called delete section');
          await handlePublish() 
        }, 1200);
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: json.message || "Delete failed",
          confirmButtonText: "OK",
          confirmButtonColor: "#673ab7"
        });
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Network error",
        confirmButtonText: "OK",
        confirmButtonColor: "#673ab7"
      });
    }
  }


  /* ------------------------------
  Publish
  ------------------------------ */

  async function handlePublish() {
    const dashboard = document.querySelector('.experiment-dashboard');
    const tableId = (dashboard && dashboard.getAttribute('data-table-id'));
    const res = await fetch(location.origin + '/_hcms/api/publishExperiment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tableId: String(tableId) })
    });
    const json = await res.json();
    console.log(json);
    
  }

  /* ------------------------------
  Navigation
  ------------------------------ */

  function switchView(view) {
    if (view === 'dashboard' || view === 'all' || view === 'active' || view === 'pending') {
      clearFormMessage();
    }

    const isHomeVariant = view === 'dashboard' || view === 'active' || view === 'pending';

    $$('.view-panel').forEach((p) => {
      if (isHomeVariant) {
        const showDash = p.id === 'view-dashboard';
        p.classList.toggle('active', showDash);
        p.setAttribute('aria-hidden', showDash ? 'false' : 'true');
      } else {
        const show = p.id === `view-${view}`;
        p.classList.toggle('active', show);
        p.setAttribute('aria-hidden', show ? 'false' : 'true');
      }
    });

    $$('.nav-item').forEach((n) => {
      const active = n.dataset.view === view;
      n.classList.toggle('active', active);
      if (active) n.setAttribute('aria-current', 'page');
      else n.removeAttribute('aria-current');
    });

    if (isHomeVariant) {
      const listMode = view === 'dashboard' ? 'all' : view;
      renderDashboardRecent(listMode);
    }

    if (view === 'all') applyFilters();

  }

  /* ------------------------------
  Bind Events
  ------------------------------ */

  function bind() {

    $$('.nav-item').forEach(btn => {
      btn.onclick = () => {
        if (btn.dataset.view === 'new') {
          clearFormMessage();
          setFormEditMode(false);
        }
        switchView(btn.dataset.view);
      };
    });

    document.addEventListener("click", function (e) {
      const deleteBtn = e.target.closest(".experiment-dashboard .btn-delete, .experiment-dashboard .delete-btn");
      const editBtn = e.target.closest(".experiment-dashboard .btn-edit, .experiment-dashboard .edit-btn");
      if (deleteBtn) {
        const rowId = deleteBtn.getAttribute("data-row-id") || deleteBtn.getAttribute("data-id");
        if (rowId) handleDelete(rowId);
      }
      if (editBtn) {
        const rowId = editBtn.getAttribute("data-row-id") || editBtn.getAttribute("data-id");
        if (rowId) handleEdit(rowId);
      }
    });

    $('#filter-search')?.addEventListener('input', applyFilters);

    $$('#filter-brand,#filter-page-type,#filter-test-type,#filter-owner,#filter-business-unit,#filter-status,#filter-date-field')
      .forEach(el => el?.addEventListener('change', applyFilters));

    $('#filter-date-start')?.addEventListener('change', applyFilters);
    $('#filter-date-end')?.addEventListener('change', applyFilters);

    $('#filter-reset')?.addEventListener('click', resetFilters);

    $('#sidebar-filter-business-unit')?.addEventListener('change', refreshGlobalScopeViews);

    const form = $('#experiment-form');
    form?.addEventListener('submit', handleFormSubmit);
    $('#form-cancel-btn')?.addEventListener('click', () => {
      setFormEditMode(false);
      switchView('dashboard');
    });
    form?.addEventListener('input', (e) => {
      const row = e.target.closest('.form-row');
      if (row) row.querySelector('.field-error') && (row.querySelector('.field-error').textContent = '');
    });
    form?.addEventListener('change', (e) => {
      const row = e.target.closest('.form-row');
      if (row) row.querySelector('.field-error') && (row.querySelector('.field-error').textContent = '');
    });
  }

  /* ------------------------------
  Init
  ------------------------------ */

  function init() {
    renderStats();
    fillFilterOptions();
    fillFormSelectOptions();
    renderAllTable();
    renderPagination();
    bind();
    switchView('dashboard');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();