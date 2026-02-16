async initServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            // Fix: Use root path since service-worker.js is in root
            const registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'  // Changed from '/smart-location-tracker/'
            });
            console.log('✅ ServiceWorker registered:', registration);

            // Check for background sync support
            if ('SyncManager' in window) {
                try {
                    const status = await navigator.permissions.query({
                        name: 'periodic-background-sync',
                    });
                    
                    if (status.state === 'granted') {
                        await registration.periodicSync.register('sync-locations', {
                            minInterval: 60 * 60 * 1000, // 1 hour
                        });
                    }
                } catch (e) {
                    console.log('Periodic sync not supported');
                }
            }
        } catch (error) {
            console.error('❌ ServiceWorker registration failed:', error);
            console.log('⚠️ App will work without offline support');
        }
    }
}
