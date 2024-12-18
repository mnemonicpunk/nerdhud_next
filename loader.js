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

window.nhud = "hello world";