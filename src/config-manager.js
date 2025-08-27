const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.configPath = path.join(process.cwd(), 'config.json');
  }

  loadConfig() {
    const config = {};

    // 1. Load from config file if exists
    if (fs.existsSync(this.configPath)) {
      try {
        const fileConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        Object.assign(config, fileConfig);
      } catch (error) {
        console.warn('⚠️  Warning: Could not parse config.json, using defaults');
      }
    }

    // 2. Load from environment variables
    if (process.env.GITHUB_ORG) {
      config.organization = process.env.GITHUB_ORG;
    }
    if (process.env.GITHUB_REPOS) {
      config.repositories = process.env.GITHUB_REPOS.split(',').map(r => r.trim());
    }
    if (process.env.GITHUB_EXCLUDE_REPOS) {
      config.excludeRepositories = process.env.GITHUB_EXCLUDE_REPOS.split(',').map(r => r.trim());
    }
    if (process.env.GITHUB_OUTPUT_DIR) {
      config.outputDirectory = process.env.GITHUB_OUTPUT_DIR;
    }

    return this.mergeWithDefaults(config);
  }

  mergeWithDefaults(config) {
    const defaults = {
      organization: null,
      repositories: [],
      defaultPeriod: 'quarterly',
      outputDirectory: 'reports',
      excludeRepositories: [],
      repositoryFilters: {
        minCommits: 0,
        excludeArchived: true,
        excludeForks: true,
        minSize: 0
      }
    };

    return { ...defaults, ...config };
  }

  saveConfig(config) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log(`✅ Configuration saved to ${this.configPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to save configuration: ${error.message}`);
      return false;
    }
  }

  configExists() {
    return fs.existsSync(this.configPath);
  }

  validateConfig(config) {
    const errors = [];

    if (!config.organization) {
      errors.push('Organization name is required');
    }

    if (!config.repositories || config.repositories.length === 0) {
      errors.push('At least one repository must be specified');
    }

    if (!['weekly', 'monthly', 'quarterly', '6months', 'yearly'].includes(config.defaultPeriod)) {
      errors.push('Invalid default period. Must be one of: weekly, monthly, quarterly, 6months, yearly');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  requiresSetup(config) {
    return !config.organization || config.repositories.length === 0;
  }
}

module.exports = ConfigManager;