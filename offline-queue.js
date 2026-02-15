class OfflineQueue {
    constructor() {
        this.dbName = 'LocationTrackerDB';
        this.dbVersion = 1;
        this.storeName = 'offlineLocations';
        this.initDB();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    // Create object store for offline locations
                    const store = db.createObjectStore(this.storeName, { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    
                    // Create indexes for querying
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('synced', 'synced', { unique: false });
                }
            };
        });
    }

    async queueLocation(locationData) {
        try {
            await this.initDB();
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                
                const location = {
                    ...locationData,
                    timestamp: Date.now(),
                    synced: false
                };
                
                const request = store.add(location);
                
                request.onsuccess = () => {
                    console.log('Location queued offline:', location);
                    this.updateQueueCount();
                    resolve(request.result);
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to queue location:', error);
        }
    }

    async getQueuedLocations() {
        try {
            await this.initDB();
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to get queued locations:', error);
            return [];
        }
    }

    async syncWithFirestore(userId) {
        try {
            const locations = await this.getQueuedLocations();
            
            if (locations.length === 0) {
                return;
            }
            
            console.log(`Syncing ${locations.length} offline locations...`);
            
            const db = firebaseServices.db;
            const batch = db.batch();
            
            for (const location of locations) {
                const docRef = db.collection('locations').doc();
                batch.set(docRef, {
                    userId,
                    ...location,
                    syncedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            await batch.commit();
            
            // Clear synced locations
            await this.clearSyncedLocations(locations);
            
            console.log('Offline locations synced successfully');
            this.updateQueueCount();
            
        } catch (error) {
            console.error('Failed to sync offline locations:', error);
            
            // Register for background sync if available
            if ('serviceWorker' in navigator && 'SyncManager' in window) {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register('sync-locations');
            }
        }
    }

    async clearSyncedLocations(locations) {
        await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            let completed = 0;
            
            locations.forEach(location => {
                const request = store.delete(location.id);
                request.onsuccess = () => {
                    completed++;
                    if (completed === locations.length) {
                        resolve();
                    }
                };
                request.onerror = () => reject(request.error);
            });
        });
    }

    async updateQueueCount() {
        try {
            const locations = await this.getQueuedLocations();
            const countElement = document.getElementById('offlineQueue');
            if (countElement) {
                countElement.textContent = `Offline queue: ${locations.length}`;
            }
        } catch (error) {
            console.error('Failed to update queue count:', error);
        }
    }

    async getQueueSize() {
        const locations = await this.getQueuedLocations();
        return locations.length;
    }
}

// Initialize offline queue
const offlineQueue = new OfflineQueue();
