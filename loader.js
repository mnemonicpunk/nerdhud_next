// Helper function to resolve "builtin:" paths to Chrome extension URLs
async function resolveURL(path) {
    path = window.nhud_repo + path;
    if (path.startsWith("builtin:")) {
        return await getChromeURL(path.replace('builtin:', ''));
    }
}

async function getChromeURL(url) {
    return new Promise((resolve, reject) => {
        // Handler for messages
        function handleMessage(event) {
            if (event.data.type === 'resolve_url' && event.data.url && event.data.original_url == url) {
                window.removeEventListener('message', handleMessage); // Clean up listener
                resolve(event.data.url);
            }
        }

        // Add event listener for the response
        window.addEventListener('message', handleMessage);

        // Send out the message for resolving the URL
        window.postMessage({
            type: 'get_url',
            url
        });
    });
}

window.addEventListener('message', (msg) => {
    if (msg.data && msg.data.type === "load_libPixels") {
        const scriptElement = document.createElement('script');
        scriptElement.textContent = msg.data.libPixels;

        // Inject the script into the document head
        (document.head || document.documentElement).appendChild(scriptElement);
        scriptElement.remove(); // Clean up after execution

        console.log("libPixels injected...");
    }
});
window.postMessage('libPixels_loader_ready');

async function loadNerdHud(unresolved_url) {
    let url = unresolved_url;
    if (url.startsWith("builtin:")) {
        url = await getChromeURL(unresolved_url.replace('builtin:', ''));
    }
    
    // Add a unique query parameter to the URL to prevent caching
    const noCacheUrl = `${url}?_=${new Date().getTime()}`;

    const response = await fetch(noCacheUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch loadout file: ${response.statusText}`);
    }
    const install = await response.json();
    window.nhud_install = install;
    window.nhud_repo = install.repo;

    // Create a script element to load the HUDt
    const hudElement = document.createElement('script');

    const HudUrl = await resolveURL(install.hud);

    // Calculate a timestamp that changes every 5 minutes
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    const currentTimestamp = Math.floor(Date.now() / fiveMinutes) * fiveMinutes;

    // Append the timestamp to the HUD URL
    const noCacheHudUrl = `${HudUrl}?_=${currentTimestamp}`;

    hudElement.src = noCacheHudUrl;

    // Inject the script into the document head
    (document.head || document.documentElement).appendChild(hudElement);
    hudElement.remove(); // Clean up after execution
}

loadNerdHud("https://raw.githubusercontent.com/mnemonicpunk/nerdhud_next/refs/heads/main/install.json");
//loadNerdHud("builtin:install_builtin.json");


