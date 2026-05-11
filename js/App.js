class App {
    constructor() {
        this.init();
    }

    async init() {
        // Detects if device is in standalone mode
        const isInStandaloneMode = () => 
            ('standalone' in window.navigator && window.navigator.standalone) || 
            window.matchMedia('(display-mode: standalone)').matches;

        // Register the Service Worker
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('Service Worker registered successfully:', registration.scope);
                
                let statusText = "Maidenhead Ready.";
                if (!isInStandaloneMode()) {
                    statusText += "\nInstall from Share Menu (iOS) or Prompt (Android).";
                }
                document.getElementById('status').innerText = statusText;
            } catch (error) {
                console.error('Service Worker registration failed:', error);
                document.getElementById('status').innerText = "Service Worker Error.";
            }
        } else {
            document.getElementById('status').innerText = "Service Workers not supported in this browser.";
        }
        
        this.checkIosInstall(isInStandaloneMode);
    }

    checkIosInstall(isInStandaloneMode) {
        // Detects if device is on iOS 
        const isIos = () => {
            const userAgent = window.navigator.userAgent.toLowerCase();
            return /iphone|ipad|ipod/.test(userAgent);
        };
        
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