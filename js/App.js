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
        
        this.checkIosInstall();
    }

    checkIosInstall() {
        // Detects if device is on iOS 
        const isIos = () => {
            const userAgent = window.navigator.userAgent.toLowerCase();
            return /iphone|ipad|ipod/.test(userAgent);
        };
        
        // Detects if device is in standalone mode
        const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

        // Show the popup if on iOS and not already installed
        if (isIos() && !isInStandaloneMode()) {
            setTimeout(() => {
                const popup = document.getElementById('ios-install-popup');
                if (popup) popup.classList.add('show');
            }, 1000); // Wait 1 second before showing
        }
    }
}

// Boot the app
new App();