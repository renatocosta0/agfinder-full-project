// Script to clear React Native cache and restart the app
console.log('Clearing React Native cache and restarting the app...');

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths to clear
const pathsToClear = [
  path.join(__dirname, 'node_modules/.cache'),
  path.join(__dirname, '.expo'),
  path.join(__dirname, '.babel-cache')
];

// Clear cache directories
pathsToClear.forEach(dirPath => {
  if (fs.existsSync(dirPath)) {
    console.log(`Clearing ${dirPath}...`);
    try {
      if (process.platform === 'win32') {
        execSync(`rmdir /s /q "${dirPath}"`);
      } else {
        execSync(`rm -rf "${dirPath}"`);
      }
    } catch (error) {
      console.error(`Error clearing ${dirPath}:`, error.message);
    }
  }
});

console.log('Cache cleared. Restarting app...');

// Restart the app (adjust command based on your setup)
try {
  execSync('npm start -- --reset-cache', { stdio: 'inherit' });
} catch (error) {
  console.error('Error restarting app:', error.message);
}
