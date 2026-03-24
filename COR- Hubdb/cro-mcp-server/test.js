require('dotenv').config();
const axios = require('axios');

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBDB_TABLE_ID = process.env.HUBDB_TABLE_ID;

async function test2() {
  const response = await axios.get(
    `https://api.hubapi.com/cms/v3/hubdb/tables/${HUBDB_TABLE_ID}/rows`,
    { headers: { 'Authorization': `Bearer ${HUBSPOT_API_KEY}` } }
  );

  const row = response.data.results[0];
  const v = row.values;

  console.log('✅ brand:                ', v.brand?.label || v.brand || '—');
  console.log('✅ landing_page (Test Title):', v.landing_page || '—');
  console.log('✅ page_type:            ', v.page_type?.label || v.page_type || '—');
  console.log('✅ test_type:            ', v.test_type?.label || v.test_type || '—');
  console.log('✅ changes:              ', v.changes || '—');
  console.log('✅ url:                  ', v.url || '—');
  console.log('✅ hypothesis:           ', (v.hypothesis || '').substring(0, 80) || '—');
  console.log('✅ owner:                ', v.owner?.label || v.owner || '—');
  console.log('✅ status:               ', v.status?.label || v.status || '—');
  console.log('✅ set_date:             ', v.set_date
    ? new Date(v.set_date).toLocaleDateString('en-IN') : '—');
  console.log('✅ review_date:          ', v.review_date
    ? new Date(v.review_date).toLocaleDateString('en-IN') : '—');
  console.log('✅ results:              ', (v.results || '').substring(0, 80) || '—');
}


async function test() {

  const cro = await axios.get(
    'https://api.hubapi.com/cms/v3/hubdb/tables/207921547/rows',
    { headers: { 'Authorization': `Bearer ${HUBSPOT_API_KEY}` } }
  );
  console.log('✅ Rows:', cro.data.total);
  console.log('Sample:', JSON.stringify(cro.data.results?.[0]?.values, null, 2));
}

async function test3() {
  const response = await axios.get(
    `https://api.hubapi.com/cms/v3/hubdb/tables/${HUBDB_TABLE_ID}/rows`,
    { headers: { 'Authorization': `Bearer ${HUBSPOT_API_KEY}` } }
  );

  // Saare raw keys dekho pehli row ke
  const v = response.data.results[0].values;
  console.log('=== RAW KEYS ===');
  console.log(Object.keys(v));

  console.log('\n=== RAW VALUES ===');
  console.log(JSON.stringify(v, null, 2));
}

async function test4() {
  const response = await axios.get(
    `https://api.hubapi.com/cms/v3/hubdb/tables/${HUBDB_TABLE_ID}/rows`,
    { headers: { 'Authorization': `Bearer ${HUBSPOT_API_KEY}` } }
  );

  const rows = response.data.results;

  // Woh row dhundho jisme test_type aur status dono hain
  const fullRow = rows.find(r => r.values.test_type && r.values.status);

  if (fullRow) {
    console.log('✅ test_type:', JSON.stringify(fullRow.values.test_type, null, 2));
    console.log('✅ status:   ', JSON.stringify(fullRow.values.status, null, 2));
  } else {
    console.log('❌ Koi row nahi mili jisme dono fields hain');
    // Sirf test_type wali row dekho
    const testTypeRow = rows.find(r => r.values.test_type);
    const statusRow = rows.find(r => r.values.status);
    console.log('test_type row:', JSON.stringify(testTypeRow?.values?.test_type, null, 2));
    console.log('status row:   ', JSON.stringify(statusRow?.values?.status, null, 2));
  }
}

async function test5() {
  // Table schema dekho — saare fields aur options
  const response = await axios.get(
    'https://api.hubapi.com/cms/v3/hubdb/tables/' + HUBDB_TABLE_ID,
    { headers: { 'Authorization': 'Bearer ' + HUBSPOT_API_KEY } }
  );

  var columns = response.data.columns;
  columns.forEach(function (col) {
    if (col.options && col.options.length > 0) {
      console.log('\n=== ' + col.name + ' (' + col.label + ') ===');
      col.options.forEach(function (opt) {
        console.log('  ID: ' + opt.id + ' | Name: ' + opt.name + ' | Label: ' + opt.label);
      });
    }
  });
}

async function test6() {

  // Date test — 2026-03-18 ka timestamp
  var testDate = new Date('2026-03-18').getTime();
  console.log('Date timestamp:', testDate);

   var payload = {
    values: {
      brand: {
            "name": "POS Nation",
            "type": "option",
      },   // { id: 13 } nahi — sirf number
      landing_page: 'Demo page test',
      changes:      'Test change',
      page_type:    2,    // sirf number
      test_type:    11,   // sirf number
      hypothesis:   'Test hypothesis',
      owner:        2,    // sirf number
      status:       2,    // sirf number
      set_date:     testDate,
    }
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));

  axios.post(
    'https://api.hubapi.com/cms/v3/hubdb/tables/' + HUBDB_TABLE_ID + '/rows',
    payload,
    { headers: { 'Authorization': 'Bearer ' + HUBSPOT_API_KEY } }
  )
    .then(function (res) {
      console.log('SUCCESS! Row ID:', res.data.id);

      // Publish karo
      return axios.post(
        'https://api.hubapi.com/cms/v3/hubdb/tables/' + HUBDB_TABLE_ID + '/draft/publish',
        {},
        { headers: { 'Authorization': 'Bearer ' + HUBSPOT_API_KEY } }
      );
    })
    .then(function () {
      console.log('Published!');
    })
    .catch(function (error) {
      console.log('Error:', error.response ? error.response.status : error.message);
      console.log('Details:', JSON.stringify(error.response ? error.response.data : error, null, 2));
    });
}

test6().catch(console.error);