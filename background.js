// background.js

function resolveBuiltinPath(path) {
    return chrome.runtime.getURL(path.replace("builtin:", ""));
}

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

    if (message.type === "show_hud_notification") {
        const { title, message: notificationMessage, icon } = message;
    
        // Get the current active tab ID dynamically
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            const originTabId = sender.tab.id;
    
            let callback = () => {
                sendResponse({
                    type: 'hud_notification_cleared'
                });
            };
    
            chrome.notifications.create({
                type: "basic",
                iconUrl: icon || chrome.runtime.getURL('img/nhud_icon_nerd.png'), // Default icon if not provided
                title: title,
                message: notificationMessage
            }, (notificationId) => {
                if (chrome.runtime.lastError) {
                    console.error("Failed to create notification:", chrome.runtime.lastError);
                } else { 
                    // Automatically dismiss the notification after 5 seconds
                    setTimeout(() => {
                        chrome.notifications.clear(notificationId, () => {
                            callback();
                        });
                    }, 5000); // 5000 milliseconds = 5 seconds
    
                    // Add click event listener for the notification
                    chrome.notifications.onClicked.addListener((clickedNotificationId) => {
                        if (clickedNotificationId === notificationId) {
                            chrome.tabs.update(originTabId, { active: true }); // Bring the originating tab to focus
                            chrome.notifications.clear(notificationId); // Clear the notification
                            callback();
                        }
                    });
    
                    // Handle notification timeout or dismissal
                    chrome.notifications.onClosed.addListener((closedNotificationId, byUser) => {
                        if (closedNotificationId === notificationId) {
                            if (!byUser) {
                                callback();
                            }
                        }
                    });
                }
            });
        });
        return true;
    }   
    
    if (message.type === "put_cloud_storage") {
        let data = message.data;
        try {
            const response = fetch(`https://pixelnerds.xyz/api/hud/save/${data.mid}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data.data),
            }).then(response => {
                if (!response.ok) {
                    console.error("Cloud save failed:", response.statusText);
                } else {
                    console.log("Cloud save successful!", data);
                }
            })
        } catch (error) {
            console.error("Error during cloud save:", error);
        }
    }

    if (message.type === "get_cloud_storage") {
        let data = message.data;

        fetch(`https://pixelnerds.xyz/api/hud/save/${data.mid}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        }).then(response => {
            if (!response.ok) {
                console.log("Cloud load failed:", response.statusText, message);
                chrome.tabs.sendMessage(sender.tab.id, {
                    type: "get_cloud_storage_result",
                    data: null
                });
            }
            return response.json(); // Only attempt JSON parsing for valid responses
        }).then(loaded_data => {
            console.log("Cloud load successful!", loaded_data);
            chrome.tabs.sendMessage(sender.tab.id, {
                type: "get_cloud_storage_result",
                data: loaded_data
            });
        }).catch(error => {
            console.error("Error during fetch or JSON parsing:", error);
            chrome.tabs.sendMessage(sender.tab.id, {
                type: "get_cloud_storage_result",
                data: null
            });
        });        
       
        return true;
    }
});
