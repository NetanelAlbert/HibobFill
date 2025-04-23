// Configuration - no longer needed as it's moved to content.js
// const TIMEZONE_OFFSET = -180; // Keep this for status display only - Removed, not used
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

// Global variable for selected timesheet ID
let selectedTimesheetId = null;

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
        if (selectedTimesheetId === null) {
            showStatus('Please select a timesheet first.', true);
            fillButton.disabled = false;
            return;
        }
        try {
            const settings = await saveSettings();
            const response = await sendMessageToContentScript({
                action: 'fillSingleDay',
                date: date,
                settings: settings,
                timesheetId: selectedTimesheetId // Pass selected timesheet ID
            });
            
            if (response.success) {
                dayItem.remove();
                showStatus(`Successfully filled attendance for ${date}`);
                // Optionally, check if missingDaysContainer is now empty
                const container = document.getElementById('missingDays');
                if (!container.hasChildNodes() || container.children.length === 1 && container.children[0].id === 'loading') {
                     container.innerHTML = '<div style="text-align: center; padding: 8px;">No missing days found</div>';
                     document.getElementById('fillAll').disabled = true;
                }
            } else if (response.error) {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error(`[HiBob Extension Popup] Error filling single day ${date}:`, error);
            showStatus(`Failed to fill attendance for ${date}: ${error.message}`, true);
            fillButton.disabled = false;
        }
    };
    
    dayItem.appendChild(dateSpan);
    dayItem.appendChild(fillButton);
    return dayItem;
}

// Helper function to format date range for display
function formatTimesheetOption(sheet) {
    const format = (dateStr) => {
        if (!dateStr) return '?';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };
    const start = format(sheet.cycleStartDate);
    const end = format(sheet.cycleEndDate);

    // Simple month name lookup
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let monthName = '?';
    if (sheet.cycleStartDate) {
        const monthIndex = parseInt(sheet.cycleStartDate.split('-')[1], 10) - 1;
        monthName = monthNames[monthIndex] || '?';
    }
    const year = sheet.cycleStartDate ? sheet.cycleStartDate.split('-')[0] : '?';

    return `${monthName} ${year} (${start} - ${end})`;
}

document.addEventListener('DOMContentLoaded', async () => {
    const missingDaysContainer = document.getElementById('missingDays');
    const fillAllButton = document.getElementById('fillAll');
    const loadingElement = document.getElementById('loading');
    const mainContent = document.getElementById('mainContent');
    const wrongSiteMessage = document.getElementById('wrongSiteMessage');
    const toggleAdvancedButton = document.getElementById('toggleAdvanced');
    const advancedPanel = document.getElementById('advancedPanel');
    const toggleDaysButton = document.getElementById('toggleDays');
    // Added: Get timesheet elements
    const timesheetContainerElement = document.getElementById('timesheetContainer');
    const timesheetSelectElement = document.getElementById('timesheetSelect');

    // Load saved settings
    await loadSettings();

    // Toggle advanced settings panel
    toggleAdvancedButton.addEventListener('click', () => {
        const isHidden = advancedPanel.style.display === 'none';
        advancedPanel.style.display = isHidden ? 'flex' : 'none';
        toggleAdvancedButton.textContent = isHidden ? 'Hide Advanced Settings' : 'Show Advanced Settings';
    });

    // Toggle missing days panel
    toggleDaysButton.addEventListener('click', () => {
        const isHidden = missingDaysContainer.style.display === 'none';
        missingDaysContainer.style.display = isHidden ? 'flex' : 'none';
        toggleDaysButton.textContent = isHidden ? 'Hide Days' : 'Show Days';
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
        loadingElement.style.display = 'none'; // Hide loading if not on HiBob
        return;
    }

    // --- Timesheet Loading and Selection ---
    async function loadTimesheets() {
        loadingElement.textContent = 'Loading timesheets...';
        loadingElement.style.display = 'block';
        missingDaysContainer.style.display = 'none'; // Hide days while loading timesheets
        toggleDaysButton.style.display = 'none'; // Hide toggle button too
        fillAllButton.disabled = true; // Disable fill all initially

        try {
            const response = await sendMessageToContentScript({ action: 'getTimesheets' });
            console.log('[HiBob Extension Popup] Timesheets received:', response);

            if (response.error) {
                throw new Error(response.error);
            }
            if (!response.timesheets || response.timesheets.length === 0) {
                 showStatus('No available (unlocked) timesheets found.', true);
                 loadingElement.style.display = 'none';
                 return; // Stop if no timesheets
            }

            const timesheets = response.timesheets;
            timesheetSelectElement.innerHTML = ''; // Clear previous options

            // Find default: first non-zero ID, otherwise the zero ID if present
            let defaultSheet = timesheets.find(sheet => sheet.id !== 0);
            if (!defaultSheet) {
                defaultSheet = timesheets.find(sheet => sheet.id === 0);
            }

            timesheets.forEach(sheet => {
                const option = document.createElement('option');
                option.value = sheet.id;
                option.textContent = formatTimesheetOption(sheet);
                if (defaultSheet && sheet.id === defaultSheet.id) {
                    option.selected = true;
                    selectedTimesheetId = sheet.id; // Set global selected ID
                }
                timesheetSelectElement.appendChild(option);
            });

            // If no default was found (e.g., empty array after filtering), select the first one
            if (selectedTimesheetId === null && timesheets.length > 0) {
                 selectedTimesheetId = timesheets[0].id;
                 timesheetSelectElement.value = selectedTimesheetId;
            }

            console.log('[HiBob Extension Popup] Selected timesheet ID:', selectedTimesheetId);

            timesheetContainerElement.style.display = 'flex'; // Show the selector
            toggleDaysButton.style.display = 'block'; // Show the toggle days button

            // Add event listener for changes
            timesheetSelectElement.onchange = () => {
                selectedTimesheetId = parseInt(timesheetSelectElement.value, 10);
                console.log('[HiBob Extension Popup] Timesheet selection changed:', selectedTimesheetId);
                loadMissingDays(); // Reload days when selection changes
            };

            // Now load missing days for the selected timesheet
            await loadMissingDays();

        } catch (error) {
            console.error('[HiBob Extension Popup] Error loading timesheets:', error);
            showStatus(`Failed to load timesheets: ${error.message}`, true);
            loadingElement.textContent = 'Error loading timesheets.';
            // Keep loading visible to show the error state
        }
    }

    // --- Missing Days Loading ---
    async function loadMissingDays() {
        if (selectedTimesheetId === null) {
            // This shouldn't happen if loadTimesheets runs first, but good safeguard
            console.warn('[HiBob Extension Popup] loadMissingDays called before timesheet selected.');
            missingDaysContainer.innerHTML = '<div style="text-align: center; color: orange; padding: 8px;">Select a timesheet first.</div>';
            loadingElement.style.display = 'none';
            fillAllButton.disabled = true;
            return;
        }

        loadingElement.textContent = 'Loading missing days...';
        loadingElement.style.display = 'block';
        missingDaysContainer.innerHTML = ''; // Clear previous days
        missingDaysContainer.appendChild(loadingElement); // Show loading inside the container
        // Ensure container is visible if it was hidden by the toggle button
        missingDaysContainer.style.display = 'flex';
        fillAllButton.disabled = true; // Disable while loading

        try {
            console.log(`[HiBob Extension Popup] Requesting missing days for timesheet ${selectedTimesheetId}`);
            const response = await sendMessageToContentScript({
                action: 'getMissingDays',
                timesheetId: selectedTimesheetId // Pass selected ID
            });
            console.log('[HiBob Extension Popup] Missing days response:', response);

            loadingElement.style.display = 'none'; // Hide loading indicator

            if (response.error) {
                throw new Error(response.error);
            }

            const missingDays = response.missingDays;
            if (!missingDays || missingDays.length === 0) {
                missingDaysContainer.innerHTML = '<div style="text-align: center; padding: 8px;">No missing days found for this timesheet</div>';
                fillAllButton.disabled = true;
                return;
            }


            missingDaysContainer.innerHTML = ''; // Clear loading message before adding days
            missingDays.forEach(date => {
                missingDaysContainer.appendChild(createDayItem(date));
            });
            fillAllButton.disabled = false; // Enable fill all if days were found
            if(toggleDaysButton.textContent === 'Show Days') {
                missingDaysContainer.style.display = 'none  ';
            }
        } catch (error) {
            loadingElement.style.display = 'none';
            missingDaysContainer.innerHTML = `<div style="text-align: center; color: red; padding: 8px;">Failed to load missing days: ${error.message}</div>`;
            console.error('[HiBob Extension Popup] Error in loadMissingDays:', error);
            fillAllButton.disabled = true;
        }
    }

    // --- Event Listeners ---

    // Fill all missing days
    fillAllButton.addEventListener('click', async () => {
        if (selectedTimesheetId === null) {
            showStatus('Please select a timesheet first.', true);
            return;
        }
        fillAllButton.disabled = true;
        const originalButtonText = fillAllButton.textContent;
        fillAllButton.textContent = 'Filling...';

        try {
            const settings = await saveSettings();
            const response = await sendMessageToContentScript({
                action: 'fillAllDays',
                settings: settings,
                timesheetId: selectedTimesheetId // Pass selected timesheet ID
            });
            console.log('[HiBob Extension Popup] Fill all response:', response);

            if (response.success) {
                // Reload missing days to confirm they are gone
                await loadMissingDays();
                 // Check if loadMissingDays already showed the "No missing days" message
                if (missingDaysContainer.textContent.includes("No missing days found")) {
                    showStatus('Successfully filled all missing days');
                } else {
                    // If loadMissingDays failed or still shows days, indicate potential issue
                    showStatus('Fill all request sent. Reloading days...', false);
                }
            } else if (response.error) {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('[HiBob Extension Popup] Error in fillAllButton click:', error);
            showStatus(`Failed to fill all missing days: ${error.message}`, true);
        } finally {
            fillAllButton.disabled = !missingDaysContainer.querySelector('.day-item'); // Re-enable only if days remain
            fillAllButton.textContent = originalButtonText;
        }
    });

    // Initial load: Start by loading timesheets
    await loadTimesheets();
}); 