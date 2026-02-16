// Add this temporarily to your index.html to debug
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        console.log('📋 Service Worker Registrations:', registrations.length);
        for(let registration of registrations) {
            console.log(' - Scope:', registration.scope);
        }
    });
    
    navigator.serviceWorker.ready.then(function(registration) {
        console.log('✅ Service Worker is ready');
        console.log('   Active:', !!registration.active);
        console.log('   Installing:', !!registration.installing);
        console.log('   Waiting:', !!registration.waiting);
    });
}
