const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const logger = require('../utils/logger');

const execPromise = util.promisify(exec);

// Perform database backup
const performDatabaseBackup = async () => {
  try {
    logger.info('Starting database backup');
    
    // Create backups directory if it doesn't exist
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    
    // Generate filename with date
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${date}.sql`;
    const filepath = path.join(backupDir, filename);
    
    // Parse database URL
    const dbUrl = new URL(process.env.DATABASE_URL);
    const host = dbUrl.hostname;
    const port = dbUrl.port || '5432';
    const database = dbUrl.pathname.substring(1); // Remove leading /
    const username = dbUrl.username;
    const password = dbUrl.password;
    
    // Build pg_dump command
    const command = `PGPASSWORD=${password} pg_dump -h ${host} -p ${port} -U ${username} -F p -b -v -f ${filepath} ${database}`;
    
    // Execute backup command
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr && !stderr.includes('connecting to database')) {
      logger.error('Backup error:', stderr);
      throw new Error(stderr);
    }
    
    // Check if file was created
    if (!fs.existsSync(filepath)) {
      throw new Error('Backup file was not created');
    }
    
    // Get file size
    const stats = fs.statSync(filepath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    logger.info(`Database backup completed: ${filename} (${fileSizeMB.toFixed(2)} MB)`);
    
    // Rotate backups - keep only last 7 days
    const files = fs.readdirSync(backupDir);
    
    if (files.length > 7) {
      // Sort files by date (oldest first)
      files.sort();
      
      // Remove oldest files, keeping the 7 most recent
      for (let i = 0; i < files.length - 7; i++) {
        const fileToDelete = path.join(backupDir, files[i]);
        fs.unlinkSync(fileToDelete);
        logger.info(`Deleted old backup: ${files[i]}`);
      }
    }
    
    return { success: true, filename, filepath };
  } catch (error) {
    logger.error('Error performing database backup:', error);
    throw error;
  }
};

module.exports = {
  performDatabaseBackup,
}; 