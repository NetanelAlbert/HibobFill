# Attendance Helper for HiBob (Unofficial)

![Attendance Helper](images/screenshot.png)

This Chrome extension helps you manage your attendance entries in HiBob more efficiently.

> **Important Disclaimer:** This is an unofficial third-party tool and is NOT affiliated with, endorsed by, or connected to HiBob in any way. This extension is created by independent developers who are not associated with HiBob.

## Features

- **View Missing Days**: Easily identify days with missing attendance entries.
- **Fill Individual Days**: Add attendance entries for specific days with a single click.
- **Fill All Days**: Add attendance entries for all missing days at once.
- **Customizable Work Hours**: Set your preferred start and end times.
- **Smart Detection**: Automatically identifies holidays, weekends, and approved time off.

## Privacy Information

This extension:
- Accesses your attendance data only on HiBob while you're logged in
- Stores your settings only in your local browser
- Does not transmit your data to any external servers
- Does not modify any data without your explicit confirmation

See the full [Privacy Policy](privacy.html) for more details.

## Installation

1. **Download or Clone**: Get this repository on your local machine.
2. **Open Chrome Extensions**: Go to `chrome://extensions/` in your Chrome browser.
3. **Enable Developer Mode**: Toggle the switch in the top right corner.
4. **Load Unpacked**: Click "Load unpacked" and select the directory where you downloaded the extension.

## Usage

1. **Log In to HiBob**: Visit [HiBob](https://app.hibob.com) and log in.
2. **Open the Extension**: Click the Attendance Helper icon in your Chrome toolbar.
3. **Select Timesheet**: Choose the timesheet you want to manage.
4. **Manage Attendance**:
   - Click "Fill" next to individual days to add entries one by one.
   - Click "Fill All Missing Days" to add entries for all missing days at once.

## Development

The extension consists of:
- `manifest.json` - Extension configuration
- `popup.html` - Extension popup UI
- `popup.js` - Popup logic
- `content.js` - Content script for interacting with HiBob
- `background.js` - Background script
- `privacy.html` - Privacy policy

## Legal

"HiBob" is a trademark of HiBob Ltd. This extension is not created by, affiliated with, or endorsed by HiBob Ltd.

## Icons

Enjoy seamless attendance management with HiBob Attendance Filler!