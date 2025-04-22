// Configuration - no longer needed as it's moved to content.js
const TIMEZONE_OFFSET = -180; // Keep this for status display only
const HIBOB_URL = 'app.hibob.com';

// Default settings
const DEFAULT_SETTINGS = {
    startTime: '09:00',
    endTime: '18:00',
    startOffset: 0,
    endOffset: 0,
    minHours: 0,
    startNegativeOffset: true,
    endNegativeOffset: true
};

// Helper function to save settings
async function saveSettings() {
    const settings = {
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        startOffset: parseInt(document.getElementById('startOffset').value),
        endOffset: parseInt(document.getElementById('endOffset').value),
        minHours: parseFloat(document.getElementById('minHours').value),
        startNegativeOffset: document.getElementById('startNegativeOffset').checked,
        endNegativeOffset: document.getElementById('endNegativeOffset').checked
    };
    await chrome.storage.sync.set({ settings });
    return settings;
}

// Helper function to load settings
async function loadSettings() {
    const result = await chrome.storage.sync.get('settings');
    const settings = result.settings || DEFAULT_SETTINGS;
    
    document.getElementById('startTime').value = settings.startTime;
    document.getElementById('endTime').value = settings.endTime;
    document.getElementById('startOffset').value = settings.startOffset;
    document.getElementById('endOffset').value = settings.endOffset;
    document.getElementById('minHours').value = settings.minHours;
    document.getElementById('startNegativeOffset').checked = settings.startNegativeOffset;
    document.getElementById('endNegativeOffset').checked = settings.endNegativeOffset;
    
    return settings;
}

// Helper function to check if current tab is HiBob
async function isHiBobTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab && tab.url && tab.url.includes(HIBOB_URL);
    } catch (error) {
        console.error('[HiBob Extension Popup] Error checking tab:', error);
        return false;
    }
}

// Helper function to show status message
function showStatus(message, isError = false) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = 'status ' + (isError ? 'error' : 'success');
    setTimeout(() => {
        statusElement.className = 'status';
    }, 3000);
}

// Helper function to send message to content script
async function sendMessageToContentScript(message) {
    console.log('[HiBob Extension Popup] Sending message:', message);
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            throw new Error('No active tab found');
        }
        console.log('[HiBob Extension Popup] Sending to tab:', tab.id);
        const response = await chrome.tabs.sendMessage(tab.id, message);
        console.log('[HiBob Extension Popup] Received response:', response);
        return response;
    } catch (error) {
        console.error('[HiBob Extension Popup] Error sending message:', error);
        throw error;
    }
}

// Function to create a day item element
function createDayItem(date) {
    const dayItem = document.createElement('div');
    dayItem.className = 'day-item';
    
    const dateSpan = document.createElement('span');
    dateSpan.className = 'day-date';
    dateSpan.textContent = date;
    
    const fillButton = document.createElement('button');
    fillButton.className = 'fill-single';
    fillButton.textContent = 'Fill';
    fillButton.onclick = async () => {
        fillButton.disabled = true;
        try {
            const settings = await saveSettings();
            const response = await sendMessageToContentScript({
                action: 'fillSingleDay',
                date: date,
                settings: settings
            });
            
            if (response.success) {
                dayItem.remove();
                showStatus(`Successfully filled attendance for ${date}`);
            } else if (response.error) {
                throw new Error(response.error);
            }
        } catch (error) {
            showStatus(`Failed to fill attendance for ${date}`, true);
            fillButton.disabled = false;
        }
    };
    
    dayItem.appendChild(dateSpan);
    dayItem.appendChild(fillButton);
    return dayItem;
}

document.addEventListener('DOMContentLoaded', async () => {
    const missingDaysContainer = document.getElementById('missingDays');
    const fillAllButton = document.getElementById('fillAll');
    const loadingElement = document.getElementById('loading');
    const mainContent = document.getElementById('mainContent');
    const wrongSiteMessage = document.getElementById('wrongSiteMessage');
    const toggleAdvancedButton = document.getElementById('toggleAdvanced');
    const advancedPanel = document.getElementById('advancedPanel');

    // Load saved settings
    await loadSettings();

    // Toggle advanced settings panel
    toggleAdvancedButton.addEventListener('click', () => {
        const isHidden = advancedPanel.style.display === 'none';
        advancedPanel.style.display = isHidden ? 'flex' : 'none';
        toggleAdvancedButton.textContent = isHidden ? 'Hide Advanced Settings' : 'Show Advanced Settings';
    });

    // Save settings when they change
    const settingInputs = ['startTime', 'endTime', 'startOffset', 'endOffset', 'minHours'];
    settingInputs.forEach(id => {
        document.getElementById(id).addEventListener('change', saveSettings);
    });

    // Save settings when checkboxes change
    const settingCheckboxes = ['startNegativeOffset', 'endNegativeOffset'];
    settingCheckboxes.forEach(id => {
        document.getElementById(id).addEventListener('change', saveSettings);
    });

    const isOnHiBob = await isHiBobTab();
    
    mainContent.style.display = isOnHiBob ? 'flex' : 'none';
    wrongSiteMessage.style.display = isOnHiBob ? 'none' : 'block';
    
    if (!isOnHiBob) {
        return;
    }

    // Fill all missing days
    fillAllButton.addEventListener('click', async () => {
        fillAllButton.disabled = true;
        try {
            const settings = await saveSettings();
            const response = await sendMessageToContentScript({ 
                action: 'fillAllDays',
                settings: settings
            });
            if (response.success) {
                missingDaysContainer.innerHTML = '';
                showStatus('Successfully filled all missing days');
            } else if (response.error) {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error in fillAllButton click:', error);
            showStatus('Failed to fill all missing days', true);
        } finally {
            fillAllButton.disabled = false;
        }
    });

    // Load missing days when popup opens
    async function loadMissingDays() {
        loadingElement.style.display = 'block';
        try {
            const response = await sendMessageToContentScript({ action: 'getMissingDays' });
            
            loadingElement.style.display = 'none';
            if (response.error) {
                throw new Error(response.error);
            }

            const missingDays = response.missingDays;
            if (missingDays.length === 0) {
                missingDaysContainer.innerHTML = '<div style="text-align: center; padding: 8px;">No missing days found</div>';
                fillAllButton.disabled = true;
                return;
            }

            missingDays.forEach(date => {
                missingDaysContainer.appendChild(createDayItem(date));
            });
        } catch (error) {
            loadingElement.style.display = 'none';
            missingDaysContainer.innerHTML = '<div style="text-align: center; color: red; padding: 8px;">Failed to load missing days</div>';
            console.error('Error in loadMissingDays:', error);
        }
    }

    loadMissingDays();
}); 