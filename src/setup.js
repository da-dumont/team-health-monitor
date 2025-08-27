const readline = require('readline');
const GitHubClient = require('./github-client');
const ConfigManager = require('./config-manager');

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function question(rl, prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function runSetup() {
  console.log('🚀 GitHub AI Analyzer Setup');
  console.log('============================\n');
  
  if (!process.env.GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    console.log('💡 Create a .env file with: GITHUB_TOKEN=your_token_here');
    console.log('💡 Then run setup again\n');
    process.exit(1);
  }

  const rl = createInterface();
  const configManager = new ConfigManager();
  const githubClient = new GitHubClient();
  
  try {
    // Get organization name
    const organization = await question(rl, '📂 GitHub organization name: ');
    if (!organization.trim()) {
      console.error('❌ Organization name is required');
      process.exit(1);
    }

    console.log(`\n🔍 Discovering repositories for ${organization}...`);
    
    let repositories = [];
    try {
      const discoveredRepos = await githubClient.listRepositories(organization, {
        excludeArchived: true,
        excludeForks: true,
        minSize: 100
      });
      
      if (discoveredRepos.length === 0) {
        console.log('⚠️  No repositories found. You can add them manually.');
      } else {
        console.log(`\n📊 Found ${discoveredRepos.length} repositories:`);
        console.log('─'.repeat(50));
        
        discoveredRepos.slice(0, 10).forEach((repo, index) => {
          console.log(`${index + 1}. ${repo.name} (${repo.language || 'Unknown'}) - Updated: ${new Date(repo.updated_at).toLocaleDateString()}`);
        });
        
        if (discoveredRepos.length > 10) {
          console.log(`... and ${discoveredRepos.length - 10} more`);
        }
        
        const useAll = await question(rl, '\n🎯 Analyze all discovered repositories? (y/n): ');
        
        if (useAll.toLowerCase().startsWith('y')) {
          repositories = discoveredRepos.map(r => r.name);
        } else {
          const repoSelection = await question(rl, '📋 Enter repository names (comma-separated) or leave empty to select manually: ');
          if (repoSelection.trim()) {
            repositories = repoSelection.split(',').map(r => r.trim()).filter(r => r);
          } else {
            // Interactive selection
            console.log('\n🔍 Select repositories (enter numbers separated by commas, e.g., 1,3,5):');
            const selection = await question(rl, 'Your choice: ');
            const indices = selection.split(',').map(s => parseInt(s.trim()) - 1).filter(i => !isNaN(i) && i >= 0 && i < discoveredRepos.length);
            repositories = indices.map(i => discoveredRepos[i].name);
          }
        }
      }
      
    } catch (error) {
      console.log(`⚠️  Could not discover repositories: ${error.message}`);
      console.log('You can add repositories manually.');
    }

    // Manual repository input if needed
    if (repositories.length === 0) {
      const manualRepos = await question(rl, '📋 Enter repository names (comma-separated): ');
      if (manualRepos.trim()) {
        repositories = manualRepos.split(',').map(r => r.trim()).filter(r => r);
      }
    }
    
    if (repositories.length === 0) {
      console.error('❌ At least one repository is required');
      process.exit(1);
    }

    // Get default period
    console.log('\n⏰ Default analysis period:');
    console.log('1. Weekly (7 days)');
    console.log('2. Monthly (30 days)');
    console.log('3. Quarterly (90 days)');
    console.log('4. 6 months (180 days)');
    console.log('5. Yearly (365 days)');
    
    const periodChoice = await question(rl, 'Choose default period (1-5, default 3): ') || '3';
    const periods = ['weekly', 'monthly', 'quarterly', '6months', 'yearly'];
    const defaultPeriod = periods[parseInt(periodChoice) - 1] || 'quarterly';

    // Get output directory
    const outputDirectory = await question(rl, '📁 Output directory for reports (default: reports): ') || 'reports';

    // Advanced filters
    console.log('\n🔧 Repository filters (optional):');
    const excludeArchived = (await question(rl, '🗄️  Exclude archived repositories? (Y/n): ') || 'y').toLowerCase().startsWith('y');
    const excludeForks = (await question(rl, '🍴 Exclude forked repositories? (Y/n): ') || 'y').toLowerCase().startsWith('y');
    const minCommitsInput = await question(rl, '📊 Minimum commits for active repositories (default: 10): ') || '10';
    const minCommits = parseInt(minCommitsInput) || 10;

    // Create config object
    const config = {
      organization: organization.trim(),
      repositories,
      defaultPeriod,
      outputDirectory,
      excludeRepositories: [],
      repositoryFilters: {
        minCommits,
        excludeArchived,
        excludeForks,
        minSize: 100
      }
    };

    // Show configuration summary
    console.log('\n📋 Configuration Summary:');
    console.log('═'.repeat(40));
    console.log(`Organization: ${config.organization}`);
    console.log(`Repositories: ${config.repositories.join(', ')}`);
    console.log(`Default Period: ${config.defaultPeriod}`);
    console.log(`Output Directory: ${config.outputDirectory}`);
    console.log(`Repository Filters:`);
    console.log(`  • Exclude Archived: ${config.repositoryFilters.excludeArchived}`);
    console.log(`  • Exclude Forks: ${config.repositoryFilters.excludeForks}`);
    console.log(`  • Min Commits: ${config.repositoryFilters.minCommits}`);

    const confirm = await question(rl, '\n✅ Save this configuration? (Y/n): ') || 'y';
    
    if (confirm.toLowerCase().startsWith('y')) {
      if (configManager.saveConfig(config)) {
        console.log('\n🎉 Setup complete! You can now run:');
        console.log('   npm start                    # Run with default settings');
        console.log('   npm run weekly              # Quick weekly analysis');
        console.log('   npm run monthly             # Quick monthly analysis');
        console.log('   node src/index.js --help    # See all options');
        console.log('\n💡 Edit config.json anytime to modify your settings');
      } else {
        console.error('❌ Failed to save configuration');
        process.exit(1);
      }
    } else {
      console.log('⚠️  Setup cancelled');
    }

  } catch (error) {
    console.error(`❌ Setup failed: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

module.exports = { runSetup };