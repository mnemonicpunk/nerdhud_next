// background.js

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "report") {
        const { url, report_data } = message;

        // Validate the URL and data
        if (typeof url !== "string" || typeof report_data !== "object" || report_data === null) {
            console.error("Invalid message arguments");
            sendResponse({ success: false, error: "Invalid arguments" });
            return;
        }

        // Send the POST request
        fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(report_data)
        })
            .then(response => {
                if (!response.ok) {
                    console.log(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.hasOwnProperty("success") && data.success) {
                    sendResponse({ success: true, data });
                } else {
                    sendResponse({ success: false, data });
                }
                
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });

        // Indicate that the response will be sent asynchronously
        return true;
    }
});
