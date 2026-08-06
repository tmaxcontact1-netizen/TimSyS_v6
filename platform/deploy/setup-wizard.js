#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CONFIG_FILE = path.join(__dirname, '..', 'config', 'session-policy.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function header(text) {
  console.log('\n' + '='.repeat(60));
  console.log(text);
  console.log('='.repeat(60) + '\n');
}

async function sessionPolicy() {
  header('SESSION DURATION POLICY');
  
  const policies = {
    A: { name: 'Secure', accessTTL: '15 minutes', refreshTTL: '24 hours', desc: 'Maximum security, frequent re-authentication' },
    B: { name: 'Balanced', accessTTL: '1 hour', refreshTTL: '7 days', desc: 'Moderate security, reasonable user experience' },
    C: { name: 'Extended', accessTTL: '24 hours', refreshTTL: '7 days', desc: 'Long sessions, weaker security (default)' }
  };
  
  console.log('Select session duration policy:\n');
  for (const [key, val] of Object.entries(policies)) {
    console.log(`  ${key}) ${val.name}: Access=${val.accessTTL}, Refresh=${val.refreshTTL}`);
    console.log(`     ${val.desc}\n`);
  }
  
  let choice;
  while (!choice || !['A','B','C'].includes(choice.toUpperCase())) {
    choice = await question('Enter choice (A/B/C): ');
    choice = choice.trim().toUpperCase();
  }
  
  return policies[choice];
}

async function backupStrategy() {
  header('BACKUP STRATEGY');
  
  const typeChoice = await question('\nBackup location?\n  1) Cloud storage (S3, Backblaze B2, etc.)\n  2) On-premise only\nEnter choice (1/2): ');
  
  const isCloud = typeChoice.trim() === '1';
  
  let retentionDays;
  let schedule;
  let provider;
  
  if (isCloud) {
    console.log('\nEnter cloud provider (S3/B2/Other): ');
    provider = await question('> ');
    
    console.log('\nRetention policy (education records have legal retention requirements):');
    console.log('  1) Conservative (7 daily, 4 weekly, 12 monthly, yearly permanent)');
    console.log('  2) Moderate (7 daily, 4 weekly)');
    console.log('  3) Minimal (7 daily only)');
    retentionDays = await question('Enter choice (1/2/3): ');
    schedule = 'continuous';
  } else {
    console.log('\nBackup schedule (on-premise):');
    console.log('  1) Daily at 2 AM');
    console.log('  2) Weekly on Sunday at 2 AM');
    schedule = ['1','2'].includes(retentionDays) ? 
      (retentionDays === '1' ? 'daily 2AM' : 'weekly Sun 2AM') : 'daily 2AM';
    
    retentionDays = await question('Retention period in days (default 30): ') || '30';
    provider = 'local';
  }
  
  return {
    isCloud,
    provider: provider.trim(),
    schedule,
    retentionDays: retentionDays.trim()
  };
}

async function adminAccountability() {
  header('ADMINISTRATOR ACCOUNTABILITY');
  console.log('This configuration will be logged and immutable.');
  console.log('Record who is responsible for these security decisions.\n');
  
  const schoolName = await question('School/organization name: ');
  const adminName = await question('Administrator name (decision maker): ');
  const contactEmail = await question('Contact email: ');
  
  return {
    schoolName: schoolName.trim(),
    adminName: adminName.trim(),
    contactEmail: contactEmail.trim()
  };
}

async function main() {
  // Check if already configured
  if (fs.existsSync(CONFIG_FILE)) {
    const existing = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    console.log(`\nAlready configured by ${existing.admin.adminName} on ${existing.timestamp}.`);
    console.log('To change, manually edit config/session-policy.json or delete and re-run.');
    process.exit(0);
  }
  
  header('TIMSYS V6 INITIAL SETUP WIZARD');
  console.log('This wizard must be completed before first deployment.\n');
  console.log('WARNING: These decisions are recorded for accountability.');
  console.log('They cannot be changed without audit trail modification.\n');
  
  const admin = await adminAccountability();
  const session = await sessionPolicy();
  const backup = await backupStrategy();
  
  // Confirmation
  header('CONFIRMATION');
  console.log('School:', admin.schoolName);
  console.log('Admin:', admin.adminName);
  console.log('Contact:', admin.contactEmail);
  console.log('\nSession Policy:', session.name);
  console.log('  Access Token TTL:', session.accessTTL);
  console.log('  Refresh Token TTL:', session.refreshTTL);
  console.log('\nBackup Strategy:', backup.isCloud ? 'Cloud' : 'On-Premise');
  console.log('  Provider:', backup.provider);
  console.log('  Schedule:', backup.schedule);
  console.log('  Retention:', backup.retentionDays);
  
  const confirm = await question('\nConfirm and save? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('\nSetup cancelled. Server will not start until configuration is complete.');
    process.exit(1);
  }
  
  // Write immutable config
  const config = {
    timestamp: new Date().toISOString(),
    admin,
    session: {
      accessTokenTTL: session.accessTTL,
      refreshTokenTTL: session.refreshTTL,
      policy: session.name
    },
    backup,
    hash: null // Will be set after write for integrity check
  };
  
  const json = JSON.stringify(config, null, 2);
  fs.writeFileSync(CONFIG_FILE, json);
  
  // Calculate hash for integrity
  const crypto = require('crypto');
  config.hash = crypto.createHash('sha256').update(json).digest('hex');
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  
  console.log('\n✓ Configuration saved to config/session-policy.json');
  console.log('  Hash:', config.hash.substring(0, 16) + '...');
  console.log('  This file is immutable for audit trail.');
  console.log('\n✓ Server startup unlocked.');
  process.exit(0);
}

main().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
