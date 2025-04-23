console.log('[HiBob Extension] Content script starting to load...');

try {
    let USER_DATA = null;
    let AVAILABLE_TIMESHEETS = null;

    // Function to fetch user data
    async function fetchUserData() {
        const response = await fetch("https://app.hibob.com/api/user", {
            headers: {
                "accept": "application/json, text/plain, */*",
                "accept-language": "en",
                "bob-timezoneoffset": "-180",
                "content-type": "application/json;charset=UTF-8",
                "x-requested-with": "XMLHttpRequest"
            },
            method: "GET",
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user data');
        }

        return await response.json();
    }

    // Added: Function to fetch available timesheets
    async function fetchTimesheets() {
        if (!USER_DATA) throw new Error('User data not initialized for timesheet fetch');

        const response = await fetch(`https://app.hibob.com/api/attendance/employees/${USER_DATA.id}/timesheets`, {
            headers: {
                "accept": "application/json, text/plain, */*",
                "accept-language": "en",
                "bob-timezoneoffset": "-180",
                "content-type": "application/json;charset=UTF-8",
                "x-requested-with": "XMLHttpRequest"
            },
            method: "GET",
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error('Failed to fetch timesheets');
        }

        const data = await response.json();
        // Filter for unlocked timesheets and keep only necessary fields
        return data.employeeTimesheets
            .filter(sheet => sheet.timesheetState && !sheet.timesheetState.locked)
            .map(sheet => ({
                id: sheet.id,
                cycleStartDate: sheet.cycleStartDate,
                cycleEndDate: sheet.cycleEndDate
            }));
    }

    // Initialize the extension
    async function initialize() {
        console.log('[HiBob Extension] Fetching user data...');
        USER_DATA = await fetchUserData();
        console.log('[HiBob Extension] User data fetched successfully');
        console.log('[HiBob Extension] Fetching available timesheets...');
        AVAILABLE_TIMESHEETS = await fetchTimesheets();
        console.log('[HiBob Extension] Available timesheets fetched:', AVAILABLE_TIMESHEETS);
        console.log('[HiBob Extension] Content script initialized with configuration');
    }

    // Helper function to check if a date needs attendance filling
    function needsAttendanceFilling(entry) {
        if (entry.isSummary) return false;

        const timesheet = entry.time_attendance_employee_timesheet;

        if (timesheet.holidayOrNonWorkingDay) return false;
        if (timesheet.timeOff) return false;
        if (timesheet.entries && timesheet.entries.length > 0) return false;
        if (timesheet.entryStatus === 'WeekendEvent') return false;

        return timesheet.alerts?.some(alert => alert.alertType === 'missingEntries') || false;
    }

    // Helper function to format date for the API
    function formatDateForApi(dateStr) {
        const [_, day, month, year] = dateStr.match(/\w+,\s+(\d+)\/(\w+)\/(\d+)/);
        const months = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        return `${year}-${months[month]}-${day.padStart(2, '0')}`;
    }

    // Helper function to add random minutes to time
    function addRandomMinutes(time, maxOffset, allowNegative = false) {
        if (!maxOffset) return time;
        
        const [hours, minutes] = time.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        
        let randomOffset;
        if (allowNegative) {
            // Generate random number between -maxOffset and +maxOffset
            randomOffset = Math.floor(Math.random() * (maxOffset * 2 + 1)) - maxOffset;
        } else {
            // Generate random number between 0 and maxOffset
            randomOffset = Math.floor(Math.random() * (maxOffset + 1));
        }
        
        const newTotalMinutes = Math.max(0, totalMinutes + randomOffset); // Ensure we don't go below 00:00
        const newHours = Math.floor(newTotalMinutes / 60);
        const newMinutes = newTotalMinutes % 60;
        
        return `${String(Math.min(23, newHours)).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`; // Ensure we don't go above 23:59
    }

    // Function to fill attendance for a specific date
    async function fillAttendance(date, settings = {
        startTime: '09:00',
        endTime: '18:00',
        startOffset: 0,
        endOffset: 0,
        minHours: 0,
        startNegativeOffset: true,
        endNegativeOffset: true
    }) {
        if (!USER_DATA) throw new Error('User data not initialized');

        const formattedDate = formatDateForApi(date);
        const timezoneOffset = USER_DATA.timezone === "Asia/Jerusalem" ? -180 : -new Date().getTimezoneOffset();
        
        // Apply random offsets to start and end times
        const actualStartTime = addRandomMinutes(settings.startTime, settings.startOffset, settings.startNegativeOffset);
        let actualEndTime = addRandomMinutes(settings.endTime, settings.endOffset, settings.endNegativeOffset);
        
        // Ensure minimum working hours if specified
        if (settings.minHours > 0) {
            const startMinutes = actualStartTime.split(':').reduce((acc, val, idx) => acc + (idx === 0 ? Number(val) * 60 : Number(val)), 0);
            const endMinutes = actualEndTime.split(':').reduce((acc, val, idx) => acc + (idx === 0 ? Number(val) * 60 : Number(val)), 0);
            const workingMinutes = endMinutes - startMinutes;
            const minWorkingMinutes = settings.minHours * 60;
            
            if (workingMinutes < minWorkingMinutes) {
                const newEndMinutes = startMinutes + minWorkingMinutes;
                const newEndHours = Math.floor(newEndMinutes / 60);
                const newEndMins = newEndMinutes % 60;
                actualEndTime = `${String(Math.min(23, newEndHours)).padStart(2, '0')}:${String(newEndMins).padStart(2, '0')}`;
            }
        }
        
        const body = [{
            id: null,
            start: `${formattedDate}T${actualStartTime}`,
            end: `${formattedDate}T${actualEndTime}`,
            entryType: 'work',
            offset: timezoneOffset
        }];

        const response = await fetch(
            `https://app.hibob.com/api/attendance/employees/${USER_DATA.id}/attendance/entries?forDate=${formattedDate}`,
            {
                method: 'POST',
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'accept-language': 'en',
                    'bob-timezoneoffset': timezoneOffset.toString(),
                    'content-type': 'application/json;charset=UTF-8',
                    'x-requested-with': 'XMLHttpRequest'
                },
                body: JSON.stringify(body),
                credentials: 'include'
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fill attendance for ${date}`);
        }

        return true;
    }

    // Function to get all missing days for a specific timesheet
    async function getMissingDays(timesheetId) {
        if (!USER_DATA) throw new Error('User data not initialized');
        if (timesheetId === null || timesheetId === undefined) throw new Error('Timesheet ID is required');

        const timezoneOffset = USER_DATA.timezone === "Asia/Jerusalem" ? -180 : -new Date().getTimezoneOffset();

        const response = await fetch("https://app.hibob.com/api/company/views/search?idsOnly=false", {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'bob-timezoneoffset': timezoneOffset.toString(),
                'content-type': 'application/json;charset=UTF-8',
                'x-requested-with': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                instructions: [{
                    values: ["Active"],
                    operator: "text_equals",
                    fieldPath: "/internal/status"
                }],
                employeeId: USER_DATA.id,
                timesheetId: timesheetId,
                type: "time_attendance_employee_timesheet",
                fields: [
                    "/time_attendance_employee_timesheet/alerts",
                    "/time_attendance_employee_timesheet/date",
                    "/time_attendance_employee_timesheet/holidayOrNonWorkingDay",
                    "/time_attendance_employee_timesheet/timeOff",
                    "/time_attendance_employee_timesheet/entries",
                    "/time_attendance_employee_timesheet/entryStatus"
                ]
            }),
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch attendance data');
        }

        const data = await response.json();
        return data.employees.filter(needsAttendanceFilling)
            .map(entry => entry.time_attendance_employee_timesheet.date);
    }

    // Listen for messages from the popup
    console.log('[HiBob Extension] Setting up message listener');
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('[HiBob Extension] Message listener triggered');
        console.log('[HiBob Extension] Received message:', request);
        console.log('[HiBob Extension] Message sender:', sender);

        (async () => {
            try {
                // Ensure initialization is complete before handling messages
                if (!USER_DATA || AVAILABLE_TIMESHEETS === null) {
                    console.log('[HiBob Extension] Initializing on demand...');
                    await initialize();
                    console.log('[HiBob Extension] On-demand initialization complete.');
                }

                switch (request.action) {
                    case 'getTimesheets':
                        console.log('[HiBob Extension] Processing getTimesheets request');
                        sendResponse({ timesheets: AVAILABLE_TIMESHEETS });
                        break;

                    case 'getMissingDays':
                        if (request.timesheetId === null || request.timesheetId === undefined) {
                             throw new Error('Timesheet ID missing in getMissingDays request');
                        }
                        console.log(`[HiBob Extension] Processing getMissingDays request for timesheet: ${request.timesheetId}`);
                        const missingDays = await getMissingDays(request.timesheetId);
                        console.log('[HiBob Extension] Found missing days:', missingDays);
                        sendResponse({ missingDays });
                        break;

                    case 'fillSingleDay':
                        console.log(`[HiBob Extension] Processing fillSingleDay request for date: ${request.date}`);
                        await fillAttendance(request.date, request.settings);
                        console.log('[HiBob Extension] Successfully filled attendance for date:', request.date);
                        sendResponse({ success: true });
                        break;

                    case 'fillAllDays':
                        if (request.timesheetId === null || request.timesheetId === undefined) {
                             throw new Error('Timesheet ID missing in fillAllDays request');
                        }
                        console.log(`[HiBob Extension] Processing fillAllDays request for timesheet: ${request.timesheetId}`);
                        const days = await getMissingDays(request.timesheetId);
                        console.log('[HiBob Extension] Found days to fill:', days);
                        for (const date of days) {
                            console.log('[HiBob Extension] Filling attendance for date:', date);
                            await fillAttendance(date, request.settings);
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                        console.log('[HiBob Extension] Successfully filled all days');
                        const remainingDays = await getMissingDays(request.timesheetId);
                        sendResponse({ success: true, remainingDays: remainingDays });
                        break;

                    default:
                        console.warn('[HiBob Extension] Unknown action received:', request.action);
                        sendResponse({ error: `Unknown action: ${request.action}` });
                        break;
                }
            } catch (error) {
                console.error('[HiBob Extension] Error processing message:', error);
                sendResponse({ error: error.message });
            }
        })();
        return true;
    });

    console.log('[HiBob Extension] Content script loaded and listener set up.');
} catch (error) {
    console.error('[HiBob Extension] Error initializing content script:', error);
}