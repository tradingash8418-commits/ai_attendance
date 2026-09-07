const fs = require('fs');
const path = require('path');

// Base64 for a valid 192x192 PNG image
const base64Png = 'iVBORw0KGgoAAAANSU5EUgAAAMAAAADACAYAAABS3GwHAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACNSURBVHic7cExAQAAAMKg9U9tDQ8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPg2AwQAAVc6M64AAAAASUVORK5CYII=';

const buffer = Buffer.from(base64Png, 'base64');
const targetPath = path.join(__dirname, '../frontend/public/icon.png');

fs.writeFileSync(targetPath, buffer);
console.log('Successfully created frontend/public/icon.png');
