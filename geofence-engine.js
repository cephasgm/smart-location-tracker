class EnhancedGeofenceEngine extends GeofenceEngine {
    constructor() {
        super();
        this.geofenceHistory = [];
        this.geofenceRules = [];
        this.initEnhancedFeatures();
    }

    initEnhancedFeatures() {
        this.loadGeofenceRules();
        this.initGeofenceUI();
    }

    initGeofenceUI() {
        const trackingSection = document.querySelector('.tracking-section');
        if (!trackingSection) return;

        const geofencePanel = document.createElement('div');
        geofencePanel.className = 'geofence-panel';
        geofencePanel.innerHTML = `
            <div class="geofence-header">
                <h3>🚧 Advanced Geofencing</h3>
                <button class="btn btn-add" id="addGeofenceBtn">+ Add Geofence</button>
            </div>
            <div class="geofence-list" id="geofenceList">
                ${this.renderGeofenceList()}
            </div>
            <div class="geofence-history" id="geofenceHistory">
                <h4>Recent Alerts</h4>
                <div class="history-list" id="geofenceHistoryList"></div>
            </div>
        `;

        // Insert after location info
        const locationInfo = document.querySelector('.location-info');
        if (locationInfo) {
            locationInfo.parentNode.insertBefore(geofencePanel, locationInfo.nextSibling);
        }

        this.attachGeofenceEvents();
    }

    renderGeofenceList() {
        if (this.geofences.length === 0) {
            return '<div class="no-geofences">No geofences configured</div>';
        }

        return this.geofences.map(fence => `
            <div class="geofence-item" data-id="${fence.id}">
                <div class="geofence-info">
                    <span class="geofence-name">${fence.name}</span>
                    <span class="geofence-details">📍 ${fence.radius}m radius</span>
                </div>
                <div class="geofence-actions">
                    <button class="btn-icon edit" title="Edit">✏️</button>
                    <button class="btn-icon delete" title="Delete">🗑️</button>
                    <button class="btn-icon history" title="History">📊</button>
                </div>
            </div>
        `).join('');
    }

    attachGeofenceEvents() {
        document.getElementById('addGeofenceBtn')?.addEventListener('click', () => {
            this.showGeofenceDialog();
        });

        document.querySelectorAll('.geofence-item .edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.geofence-item').dataset.id;
                this.editGeofence(id);
            });
        });

        document.querySelectorAll('.geofence-item .delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.geofence-item').dataset.id;
                this.deleteGeofence(id);
            });
        });

        document.querySelectorAll('.geofence-item .history').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.geofence-item').dataset.id;
                this.showGeofenceHistory(id);
            });
        });
    }

    showGeofenceDialog(fence = null) {
        const dialog = document.createElement('div');
        dialog.className = 'dialog-overlay';
        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>${fence ? 'Edit' : 'Add'} Geofence</h3>
                <div class="dialog-form">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" id="fenceName" value="${fence?.name || ''}" placeholder="e.g., Home, Office">
                    </div>
                    <div class="form-group">
                        <label>Radius (meters)</label>
                        <input type="number" id="fenceRadius" value="${fence?.radius || 100}" min="10" max="10000">
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select id="fenceType">
                            <option value="circle" ${fence?.type === 'circle' ? 'selected' : ''}>Circle</option>
                            <option value="polygon" ${fence?.type === 'polygon' ? 'selected' : ''}>Polygon</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Actions</label>
                        <div class="checkbox-group">
                            <label><input type="checkbox" id="notifyEntry" ${fence?.notifyEntry ? 'checked' : ''}> Notify on entry</label>
                            <label><input type="checkbox" id="notifyExit" ${fence?.notifyExit ? 'checked' : ''}> Notify on exit</label>
                            <label><input type="checkbox" id="notifyDwell" ${fence?.notifyDwell ? 'checked' : ''}> Notify on dwell</label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Dwell time (minutes)</label>
                        <input type="number" id="dwellTime" value="${fence?.dwellTime || 5}" min="1" max="60">
                    </div>
                </div>
                <div class="dialog-actions">
                    <button class="btn btn-secondary" id="cancelDialog">Cancel</button>
                    <button class="btn btn-primary" id="saveGeofence">${fence ? 'Update' : 'Create'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        document.getElementById('cancelDialog').addEventListener('click', () => dialog.remove());
        
        document.getElementById('saveGeofence').addEventListener('click', () => {
            const fenceData = {
                name: document.getElementById('fenceName').value,
                radius: parseInt(document.getElementById('fenceRadius').value),
                type: document.getElementById('fenceType').value,
                notifyEntry: document.getElementById('notifyEntry').checked,
                notifyExit: document.getElementById('notifyExit').checked,
                notifyDwell: document.getElementById('notifyDwell').checked,
                dwellTime: parseInt(document.getElementById('dwellTime').value)
            };

            if (fence) {
                this.updateGeofence(fence.id, fenceData);
            } else {
                this.addGeofenceWithCurrentLocation(fenceData);
            }
            
            dialog.remove();
        });
    }

    async addGeofenceWithCurrentLocation(fenceData) {
        const currentPos = window.locationEngine?.getLastKnownLocation();
        if (!currentPos) {
            this.showToast('❌ No location available', 'error');
            return;
        }

        try {
            await this.addGeofence(
                fenceData.name,
                currentPos.lat,
                currentPos.lng,
                fenceData.radius,
                fenceData.type
            );
            
            // Add additional properties
            const newFence = this.geofences[this.geofences.length - 1];
            Object.assign(newFence, fenceData);
            
            this.refreshGeofenceList();
            this.showToast('✅ Geofence added', 'success');
        } catch (error) {
            console.error('Failed to add geofence:', error);
            this.showToast('❌ Failed to add geofence', 'error');
        }
    }

    async updateGeofence(id, fenceData) {
        const fence = this.geofences.find(f => f.id === id);
        if (!fence) return;

        Object.assign(fence, fenceData);
        
        // Update in Firestore if needed
        if (!id.startsWith('local_')) {
            try {
                const db = window.firebaseServices.db;
                await db.collection('geofences').doc(id).update(fenceData);
            } catch (error) {
                console.error('Failed to update geofence:', error);
            }
        }

        this.refreshGeofenceList();
        this.showToast('✅ Geofence updated', 'success');
    }

    async deleteGeofence(id) {
        if (!confirm('Are you sure you want to delete this geofence?')) return;

        try {
            await this.removeGeofence(id);
            this.refreshGeofenceList();
            this.showToast('✅ Geofence deleted', 'success');
        } catch (error) {
            console.error('Failed to delete geofence:', error);
            this.showToast('❌ Failed to delete geofence', 'error');
        }
    }

    refreshGeofenceList() {
        const listElement = document.getElementById('geofenceList');
        if (listElement) {
            listElement.innerHTML = this.renderGeofenceList();
            this.attachGeofenceEvents();
        }
    }

    checkGeofences(location) {
        const alerts = super.checkGeofences(location);
        
        // Add enhanced checks
        alerts.forEach(alert => {
            this.addToGeofenceHistory(alert);
            
            // Enhanced notifications
            if (alert.type === 'entry') {
                this.showEnhancedNotification(alert);
            }
        });

        return alerts;
    }

    addToGeofenceHistory(alert) {
        this.geofenceHistory.unshift({
            ...alert,
            timestamp: new Date().toLocaleString()
        });

        // Keep only last 50 alerts
        if (this.geofenceHistory.length > 50) {
            this.geofenceHistory.pop();
        }

        this.updateGeofenceHistoryUI();
    }

    updateGeofenceHistoryUI() {
        const historyList = document.getElementById('geofenceHistoryList');
        if (!historyList) return;

        historyList.innerHTML = this.geofenceHistory.map(alert => `
            <div class="history-item ${alert.type}">
                <span class="history-icon">${alert.type === 'entry' ? '📍' : '🚪'}</span>
                <span class="history-message">${alert.message}</span>
                <span class="history-time">${alert.timestamp}</span>
            </div>
        `).join('');
    }

    showEnhancedNotification(alert) {
        // Show toast
        this.showToast(alert.message, 'info');

        // Show system notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Geofence Alert', {
                body: alert.message,
                icon: 'icon-192x192.png',
                badge: 'icon-72x72.png',
                vibrate: [200, 100, 200]
            });
        }

        // Play sound if enabled
        this.playAlertSound();
    }

    playAlertSound() {
        const audio = new Audio();
        audio.src = 'data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAAA8';
        audio.play().catch(e => console.log('Audio play failed:', e));
    }

    showToast(message, type) {
        if (window.app && window.app.showToast) {
            window.app.showToast(message, type);
        }
    }
}

// Override the global GeofenceEngine
window.GeofenceEngine = EnhancedGeofenceEngine;
