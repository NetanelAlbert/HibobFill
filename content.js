console.log('[HiBob Extension] Content script starting to load...');

try {
    // Configuration
    const EMPLOYEE_ID = '2483023679005393405';
    const WORK_START_TIME = '09:00';
    const WORK_END_TIME = '18:00';
    const TIMEZONE_OFFSET = -180;
    const DEFAULT_TIMESHEET_ID = 0;

    console.log('[HiBob Extension] Content script initialized with configuration');

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

    // Function to fill attendance for a specific date
    async function fillAttendance(date) {
        const formattedDate = formatDateForApi(date);
        const body = [{
            id: null,
            start: `${formattedDate}T${WORK_START_TIME}`,
            end: `${formattedDate}T${WORK_END_TIME}`,
            entryType: 'work',
            offset: TIMEZONE_OFFSET
        }];

        const response = await fetch(
            `https://app.hibob.com/api/attendance/employees/${EMPLOYEE_ID}/attendance/entries?forDate=${formattedDate}`,
            {
                method: 'POST',
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'accept-language': 'en',
                    'bob-timezoneoffset': TIMEZONE_OFFSET.toString(),
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

    // Function to get all missing days
    async function getMissingDays() {
        const response = await fetch("https://app.hibob.com/api/company/views/search?idsOnly=false", {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'bob-timezoneoffset': TIMEZONE_OFFSET.toString(),
                'content-type': 'application/json;charset=UTF-8',
                'x-requested-with': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                instructions: [{
                    values: ["Active"],
                    operator: "text_equals",
                    fieldPath: "/internal/status"
                }],
                employeeId: EMPLOYEE_ID,
                timesheetId: DEFAULT_TIMESHEET_ID,
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
                switch (request.action) {
                    case 'getMissingDays':
                        console.log('[HiBob Extension] Processing getMissingDays request');
                        const missingDays = await getMissingDays();
                        console.log('[HiBob Extension] Found missing days:', missingDays);
                        sendResponse({ missingDays });
                        break;

                    case 'fillSingleDay':
                        console.log('[HiBob Extension] Processing fillSingleDay request for date:', request.date);
                        await fillAttendance(request.date);
                        console.log('[HiBob Extension] Successfully filled attendance for date:', request.date);
                        sendResponse({ success: true });
                        break;

                    case 'fillAllDays':
                        console.log('[HiBob Extension] Processing fillAllDays request');
                        const days = await getMissingDays();
                        console.log('[HiBob Extension] Found days to fill:', days);
                        for (const date of days) {
                            console.log('[HiBob Extension] Filling attendance for date:', date);
                            await fillAttendance(date);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                        console.log('[HiBob Extension] Successfully filled all days');
                        sendResponse({ success: true });
                        break;
                }
            } catch (error) {
                console.error('[HiBob Extension] Error processing message:', error);
                sendResponse({ error: error.message });
            }
        })();
        return true; // Required to use sendResponse asynchronously
    });

    console.log('[HiBob Extension] Content script successfully loaded and initialized');
} catch (error) {
    console.error('[HiBob Extension] Error initializing content script:', error);
}