#!/usr/bin/env node

/**
 * Helper script to bootstrap or reset admin user password
 * Usage:
 *   node bootstrap-user.js bootstrap <username> <password>
 *   node bootstrap-user.js reset <username> <new_password>
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
const envPath = join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
} else {
  dotenv.config({ override: true });
}

const MONGODB_URI = process.env.MONGODB_URI;
const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SECRET || 'default_bootstrap_secret_change_me';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env file');
  process.exit(1);
}

const [command, username, password] = process.argv.slice(2);

if (!command || !username || !password) {
  console.error('Usage:');
  console.error('  node bootstrap-user.js bootstrap <username> <password>');
  console.error('  node bootstrap-user.js reset <username> <new_password>');
  process.exit(1);
}

const apiUrl = process.env.API_URL || 'http://localhost:5050';
const endpoint = command === 'bootstrap' ? '/api/auth/bootstrap' : '/api/auth/reset-password';
const body = command === 'bootstrap' 
  ? { username, password }
  : { username, new_password: password };

console.log(`🔄 ${command === 'bootstrap' ? 'Bootstrapping' : 'Resetting password for'} user: ${username}`);
console.log(`📡 Calling: ${apiUrl}${endpoint}`);

try {
  const response = await fetch(`${apiUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bootstrap-secret': BOOTSTRAP_SECRET
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (response.ok) {
    console.log('✅ Success!');
    console.log(`   You can now login with username: ${username}`);
    console.log(`   Password: ${password}`);
  } else {
    console.error('❌ Error:', data.error || 'Unknown error');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Failed to connect to API:', error.message);
  console.error('   Make sure the API server is running on', apiUrl);
  process.exit(1);
}
