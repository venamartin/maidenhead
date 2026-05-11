class App {
    constructor() {
        this.init();
    }

    async init() {
        // Register the Service Worker
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('Service Worker registered successfully:', registration.scope);
                document.getElementById('status').innerText = "Maidenhead Ready.\nInstall from Share Menu (iOS) or Prompt (Android).";
            } catch (error) {
                console.error('Service Worker registration failed:', error);
                document.getElementById('status').innerText = "Service Worker Error.";
            }
        } else {
            document.getElementById('status').innerText = "Service Workers not supported in this browser.";
        }
    }
}

// Boot the app
new App();