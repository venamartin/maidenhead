export default class WakeLock {
    constructor(buttonElement) {
        this.wakeLock = null;
        this.isActive = false;
        this.btn = buttonElement;

        // Re-acquire the lock automatically if the user backgrounds the app and comes back
        document.addEventListener('visibilitychange', async () => {
            if (this.isActive && document.visibilityState === 'visible') {
                console.log("App returned to foreground. Re-acquiring Wake Lock...");
                await this.request();
            }
        });
    }

    async toggle() {
        if (!('wakeLock' in navigator)) {
            alert("Your browser does not support the Wake Lock API.");
            return;
        }

        if (this.isActive) {
            await this.release();
        } else {
            await this.request();
        }
    }

    async request() {
        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            this.isActive = true;
            this.updateUI();

            // The OS can still forcefully release it (e.g., low battery mode)
            this.wakeLock.addEventListener('release', () => {
                if (document.visibilityState === 'visible') {
                    console.log('Wake Lock was forcefully released by the OS.');
                    this.isActive = false;
                    this.updateUI();
                }
            });

        } catch (err) {
            console.error(`Wake Lock Error: ${err.name}, ${err.message}`);
            this.isActive = false;
            this.updateUI();
        }
    }

    async release() {
        if (this.wakeLock !== null) {
            await this.wakeLock.release();
            this.wakeLock = null;
            this.isActive = false;
            this.updateUI();
        }
    }

    updateUI() {
        if (this.btn) {
            this.btn.innerText = this.isActive ? 'Screen: ALWAYS ON' : 'Screen: AUTO DIM';
            // Simple visual feedback: Green when locked, gray when normal
            this.btn.style.backgroundColor = this.isActive ? '#28a745' : '#444';
        }
    }
}