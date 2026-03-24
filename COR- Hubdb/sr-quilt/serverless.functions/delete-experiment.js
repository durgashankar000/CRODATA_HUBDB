const axios = require('axios');

const BASE_URL = 'https://api.hubapi.com';

function resolveTableId(data) {
    const fromBody =
        data &&
        (data.hubdbTableId != null && String(data.hubdbTableId).trim() !== ''
            ? String(data.hubdbTableId).trim()
            : data.tableId != null && String(data.tableId).trim() !== ''
              ? String(data.tableId).trim()
              : '');
    const fromEnv =
        process.env.HUBDB_TABLE_ID != null && String(process.env.HUBDB_TABLE_ID).trim() !== ''
            ? String(process.env.HUBDB_TABLE_ID).trim()
            : '';
    return fromBody || fromEnv || '';
}

exports.main = async (context, sendResponse) => {
    const accessToken = process.env.MARKETPOS_HUBDB_ACCESS_TOKEN || process.env.PRIVATE_APP_ACCESS_TOKEN;
    console.log(context.body);

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

    const rowId = data.rowId != null ? String(data.rowId).trim() : '';
    const tableId = resolveTableId(data);
    console.log(rowId, 'table', tableId);
    if (!rowId) {
        sendResponse({
            body: { success: false, message: 'Missing required field: rowId.' },
            statusCode: 400
        });
        return;
    }
    if (!tableId) {
        sendResponse({
            body: { success: false, message: 'Missing table id: set hubdbTableId on the request or HUBDB_TABLE_ID in serverless secrets.' },
            statusCode: 400
        });
        return;
    }

    const encodedTable = encodeURIComponent(tableId);
    const encodedRow = encodeURIComponent(rowId);

    const client = axios.create({
        baseURL: BASE_URL,
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    try {
        // Removes row from draft; live pages still show published rows until draft/publish runs.
        await client.delete(`/cms/v3/hubdb/tables/${encodedTable}/rows/${encodedRow}/draft`);
        sendResponse({
            body: { success: true, message: 'Experiment deleted successfully.' },
            statusCode: 200
        });

    } catch (err) {
        const status = err.response && err.response.status;
        const message = (err.response && err.response.data && err.response.data.message) || err.message || '';
        const isNotFound = status === 404 || (typeof message === 'string' && message.toLowerCase().includes('could not be found'));
        if (isNotFound) {
            sendResponse({
                body: { success: true, alreadyDeleted: true },
                statusCode: 200
            });
            return;
        }
        sendResponse({
            body: { success: false, message: message || 'Failed to delete HubDB row.' },
            statusCode: status || 500
        });
    }
};
