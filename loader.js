// Helper function to resolve "builtin:" paths to Chrome extension URLs
async function resolveURL(path) {
    if (path.startsWith("builtin:")) {
        console.log("RESOLVING BUILT-IN URL: ", path);
        return await getChromeURL(path.replace('builtin:', ''));
    }
    return path;
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
    console.log("LOADING ENVIRONMENT: ", unresolved_url);
    const url = await resolveURL(unresolved_url);
    console.log("LOADING ENVIRONMENT FROM: ", url);
    
    // Fetch the loadout JSON file from the provided URL
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch loadout file: ${response.statusText}`);
    }
    const install = await response.json();
    window.nhud_install = install;

    // Create a script element to load the HUDt
    const hudElement = document.createElement('script');
    hudElement.src = install.hud;

    // Inject the script into the document head
    (document.head || document.documentElement).appendChild(hudElement);
    hudElement.remove(); // Clean up after execution
}

loadNerdHud("https://raw.githubusercontent.com/mnemonicpunk/nerdhud_next/refs/heads/main/install.json");
//loadNerdHud("builtin:install_builtin.json");


