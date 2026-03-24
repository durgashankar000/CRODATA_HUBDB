const axios = require('axios');
const ACCESS_TOKEN = process.env.GREEN_HOUSE_API_KEY
const BASE64_TOKEN = Buffer.from(ACCESS_TOKEN).toString('base64');

exports.main = async (context, sendResponse) => {
   
    const data = JSON.stringify(context.body)
    const jobID = context.body.jobid
    const postData = createAxiosConfig('POST', `https://boards-api.greenhouse.io/v1/boards/quiltllc/jobs/${jobID}`, data);

    try {
        const userResponse = await axios(postData);
        sendResponse({ body: {   data: userResponse.data, status: userResponse.status, sentPayload: data }, statusCode: 200 });
    } catch(error){
        sendResponse(handleErrorMethod(error, data))
    }
};


// ==================================== Axios configuration ============================================
const createAxiosConfig = (method, url, data = null) => ({
    method,
    url,
    maxBodyLength: Infinity,
    headers: {
        'Authorization': 'Basic YzI2YmQ1ZDhiMTFhYzEzNGEwOWNhZjM3ZTI4NzRjZWItNTo=',
        'Content-Type': 'application/json'
    },
    data
});

// ==================================== Error handler ===================================================
const handleErrorMethod = (error, message = "Error occurred", ) => {
    console.error("Error:", error.response ? error.response.data : error.message);
    return {
        statusCode: error.response ? error.response.status : 500,
        body: {
            message,
            error: error.message,
            data: error.response ? error.response.data : null,
        }
    };
};




