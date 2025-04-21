# HiBob Attendance Filler Chrome Extension

This Chrome extension helps you automatically fill missing attendance in HiBob.

## Features

- View all missing attendance days
- Fill individual days with one click
- Fill all missing days at once
- Automatically sets work hours from 9:00 to 18:00
- Skips holidays, weekends, and approved time off

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Log in to HiBob (https://app.hibob.com)
2. Click the extension icon in your Chrome toolbar
3. You'll see a list of all days with missing attendance
4. Choose to either:
   - Click "Fill" next to individual days to fill them one by one
   - Click "Fill All Missing Days" to fill all missing days at once

## Note

- The extension will fill attendance with fixed hours: 9:00 - 18:00
- It automatically skips:
  - Weekends
  - Holidays
  - Non-working days
  - Days with approved time off (vacation, sick days, etc.)
  - Days that already have attendance entries

## Development

The extension consists of:
- `manifest.json` - Extension configuration
- `popup.html` - Extension popup UI
- `popup.js` - Popup logic
- `content.js` - Content script for interacting with HiBob
- `background.js` - Background script
- `images/` - Extension icons (you need to add these)

## Icons

Before using the extension, you need to add icon files in the following sizes:
- `images/icon16.png` (16x16)
- `images/icon48.png` (48x48)
- `images/icon128.png` (128x128) 