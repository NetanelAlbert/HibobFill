// Configuration - no longer needed as it's moved to content.js
const TIMEZONE_OFFSET = -180; // Keep this for status display only
const HIBOB_URL = 'app.hibob.com';

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
            const response = await sendMessageToContentScript({
                action: 'fillSingleDay',
                date: date
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
            const response = await sendMessageToContentScript({ action: 'fillAllDays' });
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