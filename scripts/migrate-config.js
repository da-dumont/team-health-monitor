#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ConfigManager = require('../src/config-manager');

console.log('🔄 GitHub AI Analyzer Configuration Migration');
console.log('=============================================\n');

const configManager = new ConfigManager();

// Check if config already exists
if (configManager.configExists()) {
  console.log('✅ Configuration file already exists at config.json');
  console.log('💡 Run "npm run setup" to reconfigure if needed');
  process.exit(0);
}

// Check for .env file to detect existing setup
const envPath = path.join(process.cwd(), '.env');
let hasEnvFile = false;
let orgFromEnv = null;
let reposFromEnv = null;

if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    hasEnvFile = true;
    
    // Extract org and repos if they exist in .env
    const orgMatch = envContent.match(/^GITHUB_ORG=(.+)$/m);
    const reposMatch = envContent.match(/^GITHUB_REPOS=(.+)$/m);
    
    if (orgMatch) orgFromEnv = orgMatch[1].trim();
    if (reposMatch) reposFromEnv = reposMatch[1].split(',').map(r => r.trim());
    
  } catch (error) {
    console.warn('⚠️  Could not read .env file');
  }
}

// Check for existing reports to infer configuration
const reportsDir = path.join(process.cwd(), 'reports');
let inferredOrg = null;
let inferredRepos = [];

if (fs.existsSync(reportsDir)) {
  try {
    const reportFiles = fs.readdirSync(reportsDir).filter(f => f.endsWith('.json'));
    if (reportFiles.length > 0) {
      const latestReport = reportFiles.sort().pop();
      const reportData = JSON.parse(fs.readFileSync(path.join(reportsDir, latestReport), 'utf8'));
      
      if (reportData.repositories && reportData.repositories.length > 0) {
        inferredRepos = reportData.repositories.map(r => r.repository).filter(Boolean);
        console.log(`📊 Found ${inferredRepos.length} repositories in existing reports`);
      }
    }
  } catch (error) {
    console.warn('⚠️  Could not analyze existing reports');
  }
}

// Create migration configuration
let migrationConfig = {};

if (orgFromEnv || reposFromEnv || inferredRepos.length > 0) {
  console.log('🔍 Detected existing configuration:');
  
  if (orgFromEnv) {
    migrationConfig.organization = orgFromEnv;
    console.log(`  • Organization: ${orgFromEnv} (from .env)`);
  }
  
  if (reposFromEnv && reposFromEnv.length > 0) {
    migrationConfig.repositories = reposFromEnv;
    console.log(`  • Repositories: ${reposFromEnv.join(', ')} (from .env)`);
  } else if (inferredRepos.length > 0) {
    migrationConfig.repositories = inferredRepos;
    console.log(`  • Repositories: ${inferredRepos.join(', ')} (from reports)`);
  }
  
  // Add default settings
  migrationConfig = {
    ...migrationConfig,
    defaultPeriod: 'quarterly',
    outputDirectory: 'reports',
    excludeRepositories: [],
    repositoryFilters: {
      minCommits: 10,
      excludeArchived: true,
      excludeForks: true,
      minSize: 100
    }
  };
  
  // Save migrated configuration
  if (configManager.saveConfig(migrationConfig)) {
    console.log('\n✅ Configuration migrated successfully!');
    console.log('💡 You can now run "npm start" to use your saved configuration');
    console.log('💡 Run "npm run setup" anytime to modify your configuration');
  } else {
    console.error('\n❌ Failed to save migrated configuration');
    process.exit(1);
  }
  
} else {
  console.log('🆕 No existing configuration detected');
  console.log('💡 Run "npm run setup" to configure the tool for your organization');
  
  // Create a basic example config file
  const exampleConfig = {
    organization: 'your-org-name',
    repositories: ['repo1', 'repo2', 'repo3'],
    defaultPeriod: 'quarterly',
    outputDirectory: 'reports',
    excludeRepositories: [],
    repositoryFilters: {
      minCommits: 10,
      excludeArchived: true,
      excludeForks: true,
      minSize: 100
    }
  };
  
  try {
    fs.writeFileSync('config.example.json', JSON.stringify(exampleConfig, null, 2));
    console.log('📝 Created config.example.json as a reference');
  } catch (error) {
    console.warn('⚠️  Could not create example configuration file');
  }
}