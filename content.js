
// Create a script element to load the libPixels loader
const scriptElement = document.createElement('script');
scriptElement.src = chrome.runtime.getURL('loader.js');

// Inject the script into the document head
(document.head || document.documentElement).appendChild(scriptElement);
scriptElement.remove(); // Clean up after execution

let LIBPIXELS_VER = "";

const libPixels_key = 'nhud_libPixels'; // chrome storage location of libPixels, .file property contains the file contents, .version property the version number

let loader_handler = window.addEventListener('message', (msg) => {

    if (msg.data  === 'libPixels_loader_ready') {
        chrome.storage.local.get([libPixels_key], (result) => {
            const libPixels = result[libPixels_key];
        
            if (libPixels) {
                const msg = {
                    type: "load_libPixels",
                    libPixels: libPixels.file
                };
                window.postMessage(msg);
        
                LIBPIXELS_VER = libPixels.version;
            } else {
                console.log("Unable to load libPixels, awaiting install.");
            }
        });
    }
});

// Listen for messages from other parts of the extension
window.addEventListener('message', (event) => {
    const message = event.data;

    if (message.type === "get_url") {
        const { url } = message;
        let path = chrome.runtime.getURL(url);
        window.postMessage({
            type: 'resolve_url',
            url: path,
            original_url: url
        });
     }
     if (message.type === "get_storage") {
        const { key } = message;
        chrome.storage.local.get(key, (result) => {
            window.postMessage({
                type: 'get_storage_response',
                result
            });
        });
     }
     if (message.type === "put_storage") {
        const { data } = message;
        chrome.storage.local.set(data, (result) => {
            window.postMessage({
                type: 'put_storage_response',
                result,
                success: true
            });
        });
     }

     if (message.type === "report") {
        chrome.runtime.sendMessage(message);
     }

    if (message.type === "show_hud_notification") {
        chrome.runtime.sendMessage(message);
    }

    if (message.type === "put_cloud_storage") {
        chrome.runtime.sendMessage(message);
    }

    if (message.type === "get_cloud_storage") {
        chrome.runtime.sendMessage(message);
    }
});

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "hud_notification_cleared") {
        window.postMessage(message);
    }

    if (message.type === "get_cloud_storage_result") {
        window.postMessage(message);
    }
});