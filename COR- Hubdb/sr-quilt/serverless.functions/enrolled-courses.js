const axios = require('axios');
const ACCESS_TOKEN = process.env.ENROLLED_COURSES_ACCESS_TOKEN;

// ============================ Main Execution =================================

exports.main = async (context, sendResponse) => {
	try {
		const { contactId, courseId, action, emails } = context.body;

		const emailsArray = Array.isArray(emails) ? emails : [];
		const searchResponse = await searchCourses(emailsArray);
		const courseObjectIds = (searchResponse.results || []).map(item => item.id);
		console.log("Found IDs:", courseObjectIds);

		if (!courseObjectIds.length) {
			return sendResponse({
				statusCode: 200,
				body: {
					message: "No matching records found",
					ids: []
				}
			});
		}

		const results = [];
		for (const targetId of courseObjectIds) {
			let res;
			if (action === "delete") {
				res = await deleteContectToCourseAssocation(targetId, courseId);
			} else {
				res = await createContectToCourseAssocation(targetId, courseId);
			}
			results.push(res);
		}
		sendResponse({statusCode: 200,body: {status: 200,processedIds: courseObjectIds, data: results }});

	} catch (error) {
		console.error(error.response?.data || error.message);
		sendResponse({ statusCode: error.response?.status || 500, body: error.response?.data || { message: "Server error" }});
	}
};

const createContectToCourseAssocation = async (contactId, courseId) => {
	let responce =  await axios.put(`https://api.hubapi.com/crm/v3/objects/contact/${contactId}/associations/2-54929341/${courseId}/member_enrolled_course`, {}, {
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${ACCESS_TOKEN}`
		}
	})
	return responce.data
}

const deleteContectToCourseAssocation = async (contactId, courseId) => {
	let responce =  await axios.delete(`https://api.hubapi.com/crm/v3/objects/contact/${contactId}/associations/2-54929341/${courseId}/member_enrolled_course`, {
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${ACCESS_TOKEN}`
		}
	})
	return responce.data
}


// ============================ Axios Config =================================
const createAxiosConfig = (method, url, data = null) => ({
	method,
	url,
	maxBodyLength: Infinity,
	headers: {
		Authorization: `Bearer ${ACCESS_TOKEN}`,
		'Content-Type': 'application/json'
	},
	data
});
// ==================================== Search Courses ===================================================
const searchCourses = async (emails) => {
	const searchData = {
		limit: 10,
		properties: ["email"],
		filterGroups: emails.map(email => ({
			filters: [
				{
					operator: "EQ",
					propertyName: "email",
					value: email
				}
			]
		}))
	};

	const url ="https://api.hubapi.com/crm/v3/objects/contact/search";
	const response = await axios(createAxiosConfig("POST", url, searchData));
	return response.data;
};