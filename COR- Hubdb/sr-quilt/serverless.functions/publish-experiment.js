const axios = require('axios');

exports.main = async (context, sendResponse) => {
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

    const tableId =
        data.tableId != null && String(data.tableId).trim() !== ''
            ? String(data.tableId).trim()
            : data.hubdbTableId != null && String(data.hubdbTableId).trim() !== ''
              ? String(data.hubdbTableId).trim()
              : '';
    const accessToken = process.env.MARKETPOS_HUBDB_ACCESS_TOKEN || process.env.PRIVATE_APP_ACCESS_TOKEN;

    if (!tableId || !accessToken) {
        sendResponse({
            body: { success: false, message: 'Table ID or access token is missing.' },
            statusCode: 400
        });
        return;
    }
    console.log('Publishing experiment...', tableId);
    const config = {
        method: 'POST',
        url: `https://api.hubapi.com/cms/v3/hubdb/tables/${encodeURIComponent(tableId)}/draft/publish`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };
    
    try {
        const response = await axios(config);
        console.log('Publish response:' );
        sendResponse({
            body: { success: true, message: 'Experiment published successfully.', response: response.data },
            statusCode: 200
        });
    } catch (err) {
        const status = err.response && err.response.status;
        const data = err.response && err.response.data;
        const message = (data && (data.message || (typeof data === 'string' ? data : null))) || err.message || 'Failed to publish experiment.';
        sendResponse({
            body: { success: false, message: typeof message === 'string' ? message : 'Failed to publish experiment.' },
            statusCode: status || 500
        });
    }
};