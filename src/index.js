const GitHubClient = require('./github-client');
const MetricsAnalyzer = require('./metrics-analyzer');
const ConfigManager = require('./config-manager');
const { subDays, format } = require('date-fns');
const { Command } = require('commander');
require('dotenv').config();

class AIDeliveryAnalyzer {
  constructor(options = {}) {
    this.githubClient = new GitHubClient({
      cache: options.cache !== false,
      cacheMaxAge: options.cacheMaxAge,
      requestsPerHour: options.requestsPerHour,
      burstLimit: options.burstLimit
    });
    this.analyzer = new MetricsAnalyzer();
    this.repositories = options.repositories || [];
    this.organization = options.organization;
    this.currentPeriodDays = options.currentPeriodDays || 90;
    this.previousPeriodDays = options.previousPeriodDays || options.currentPeriodDays || 90;
    this.gapDays = options.gapDays || 0;
    this.excludeRepositories = options.excludeRepositories || [];
    this.repositoryFilters = options.repositoryFilters || {};
    this.batchSize = options.batchSize || 10; // Process PRs in batches
  }

  async analyzeRepository(repo) {
    console.log(`\n🔍 Analyzing ${this.organization}/${repo}...`);

    const now = new Date();
    const currentPeriodStart = subDays(now, this.currentPeriodDays);
    const previousPeriodEnd = subDays(now, this.currentPeriodDays + this.gapDays);
    const previousPeriodStart = subDays(previousPeriodEnd, this.previousPeriodDays);

    try {
      const [currentPRs, previousPRs, currentCommits, previousCommits] = await Promise.all([
        this.githubClient.getPullRequests(this.organization, repo, currentPeriodStart, now),
        this.githubClient.getPullRequests(this.organization, repo, previousPeriodStart, previousPeriodEnd),
        this.githubClient.getCommits(this.organization, repo, currentPeriodStart, now),
        this.githubClient.getCommits(this.organization, repo, previousPeriodStart, previousPeriodEnd)
      ]);

      console.log(`📊 Found ${currentPRs.length} current PRs, ${previousPRs.length} previous PRs`);
      console.log(`📊 Found ${currentCommits.length} current commits, ${previousCommits.length} previous commits`);

      const currentPRMetrics = await this.processPRs(currentPRs, repo);
      const previousPRMetrics = await this.processPRs(previousPRs, repo);

      const currentSummary = this.analyzer.calculateMetricsSummary(currentPRMetrics);
      const previousSummary = this.analyzer.calculateMetricsSummary(previousPRMetrics);

      const currentCommitFreq = this.analyzer.analyzeCommitFrequency(currentCommits, this.currentPeriodDays);
      const previousCommitFreq = this.analyzer.analyzeCommitFrequency(previousCommits, this.previousPeriodDays);

      const comparison = this.analyzer.comparePeriors(currentSummary, previousSummary);

      return {
        repository: repo,
        periods: {
          current: {
            start: format(currentPeriodStart, 'yyyy-MM-dd'),
            end: format(now, 'yyyy-MM-dd'),
            prMetrics: currentSummary,
            commitFrequency: currentCommitFreq
          },
          previous: {
            start: format(previousPeriodStart, 'yyyy-MM-dd'),
            end: format(previousPeriodEnd, 'yyyy-MM-dd'),
            prMetrics: previousSummary,
            commitFrequency: previousCommitFreq
          }
        },
        comparison,
        generatedAt: now.toISOString()
      };

    } catch (error) {
      console.error(`❌ Error analyzing ${repo}:`, error.message);
      return {
        repository: repo,
        error: error.message,
        generatedAt: now.toISOString()
      };
    }
  }

  async processPRs(prs, repo) {
    console.log(`📊 Processing ${prs.length} PRs for ${repo}...`);
    
    const prMetrics = [];
    let processed = 0;
    
    // Process PRs in batches to manage memory and show progress
    for (let i = 0; i < prs.length; i += this.batchSize) {
      const batch = prs.slice(i, i + this.batchSize);
      
      for (const pr of batch) {
        try {
          const prDetails = await this.githubClient.getPullRequestDetails(
            this.organization, 
            repo, 
            pr.number,
            pr.updated_at // For cache invalidation
          );
          
          const metric = this.analyzer.analyzePullRequest(prDetails, prDetails.reviews);
          if (metric) {
            prMetrics.push(metric);
          }
          
          processed++;
          
          // Show progress every 25 PRs
          if (processed % 25 === 0) {
            const percent = Math.round((processed / prs.length) * 100);
            console.log(`  🔄 Processed ${processed}/${prs.length} PRs (${percent}%)`);
          }
          
        } catch (error) {
          console.warn(`⚠️  Could not fetch details for PR #${pr.number}: ${error.message}`);
          processed++;
        }
      }
      
      // Small delay between batches to be gentle on API
      if (i + this.batchSize < prs.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`  ✅ Processed ${processed} PRs, found ${prMetrics.length} valid metrics`);
    return prMetrics;
  }

  async generateReport() {
    console.log('🚀 Starting AI Delivery Speed Analysis');
    const gapText = this.gapDays > 0 ? ` (with ${this.gapDays} day gap)` : '';
    console.log(`📅 Comparing last ${this.currentPeriodDays} days vs previous ${this.previousPeriodDays} days${gapText}`);
    console.log(`📁 Analyzing ${this.repositories.length} repositories\n`);
    
    // Clean up expired cache entries before starting
    this.githubClient.cleanup();
    
    const startTime = Date.now();
    const results = [];
    let completed = 0;

    for (const repo of this.repositories) {
      console.log(`
📊 Repository ${completed + 1}/${this.repositories.length}: ${repo}`);
      const result = await this.analyzeRepository(repo);
      results.push(result);
      
      completed++;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const avgTime = elapsed / completed;
      const remaining = Math.round(avgTime * (this.repositories.length - completed));
      
      console.log(`  ✅ Completed (${elapsed}s elapsed, ~${remaining}s remaining)`);
    }
    
    // Display API usage statistics
    this.githubClient.displayStats();
    
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n🏁 Analysis completed in ${totalTime}s`);

    return this.formatReport(results);
  }

  formatReport(results) {
    console.log('\n' + '='.repeat(60));
    console.log('🤖 AI TOOLING DELIVERY IMPACT REPORT');
    console.log('='.repeat(60));

    let totalImprovements = [];

    results.forEach(result => {
      if (result.error) {
        console.log(`\n❌ ${result.repository}: Error - ${result.error}`);
        return;
      }

      const { comparison, periods } = result;
      
      console.log(`\n📂 Repository: ${result.repository}`);
      console.log(`Current Period: ${periods.current.start} to ${periods.current.end}`);
      console.log(`Previous Period: ${periods.previous.start} to ${periods.previous.end}`);
      
      if (comparison.summary) {
        console.log(`\n✨ ${comparison.summary}`);
        totalImprovements.push(comparison.overallImprovement);
      }

      if (periods.current.prMetrics && periods.previous.prMetrics) {
        this.printMetricComparison('Cycle Time (Hours)', 
          periods.previous.prMetrics.cycleTime.avgHours,
          periods.current.prMetrics.cycleTime.avgHours,
          comparison.cycleTime);

        this.printMetricComparison('Review Time (Hours)', 
          periods.previous.prMetrics.reviewTime.avgHours,
          periods.current.prMetrics.reviewTime.avgHours,
          comparison.reviewTime);

        this.printMetricComparison('PR Size (Changes)', 
          periods.previous.prMetrics.prSize.avgChanges,
          periods.current.prMetrics.prSize.avgChanges,
          comparison.prSize);

        this.printMetricComparison('Total PRs', 
          periods.previous.prMetrics.totalPRs,
          periods.current.prMetrics.totalPRs,
          comparison.totalPRs);

        console.log('\n📈 Top Contributors (Current Period):');
        periods.current.prMetrics.topContributors.slice(0, 5).forEach((contributor, index) => {
          console.log(`  ${index + 1}. ${contributor.author}: ${contributor.totalPRs} PRs, ${contributor.avgCycleTime?.toFixed(1)}h avg cycle time`);
        });
      }

      console.log('\n💻 Commit Activity:');
      console.log(`  Current: ${periods.current.commitFrequency.avgCommitsPerDay.toFixed(1)} commits/day`);
      console.log(`  Previous: ${periods.previous.commitFrequency.avgCommitsPerDay.toFixed(1)} commits/day`);
    });

    if (totalImprovements.length > 0) {
      const overallImprovement = totalImprovements.reduce((a, b) => a + b, 0) / totalImprovements.length;
      const direction = overallImprovement > 0 ? 'faster' : 'slower';
      
      console.log('\n' + '='.repeat(60));
      console.log('🎯 OVERALL IMPACT SUMMARY');
      console.log('='.repeat(60));
      console.log(`AI tooling impact: ${Math.abs(overallImprovement).toFixed(1)}% ${direction} delivery across all repositories`);
      
      if (Math.abs(overallImprovement) > 10) {
        console.log('\n💡 RECOMMENDATIONS:');
        if (overallImprovement > 0) {
          console.log('✅ Significant improvement detected! Consider:');
          console.log('  - Expanding AI tool adoption to more teams');
          console.log('  - Documenting best practices from top performers');
          console.log('  - Training sessions for teams showing less improvement');
        } else {
          console.log('⚠️  Performance regression detected. Consider:');
          console.log('  - Reviewing AI tool usage patterns');
          console.log('  - Providing additional training');
          console.log('  - Investigating if tool changes caused issues');
        }
      }
    }

    return {
      summary: {
        totalRepositories: results.length,
        overallImprovementPercent: totalImprovements.length > 0 
          ? totalImprovements.reduce((a, b) => a + b, 0) / totalImprovements.length 
          : 0,
        generatedAt: new Date().toISOString()
      },
      repositories: results
    };
  }

  printMetricComparison(metricName, oldValue, newValue, comparison) {
    if (!comparison || comparison.improvement === null) return;
    
    const arrow = comparison.isImprovement ? '↗️' : '↘️';
    const sign = comparison.improvement > 0 ? '+' : '';
    
    console.log(`  ${metricName}: ${oldValue?.toFixed(1)} → ${newValue?.toFixed(1)} (${sign}${comparison.improvement.toFixed(1)}%) ${arrow}`);
  }
}

function getDateRangePresets() {
  return {
    weekly: 7,
    monthly: 30,
    quarterly: 90,
    '6months': 180,
    yearly: 365
  };
}

async function main() {
  const program = new Command();
  
  program
    .name('github-ai-analyzer')
    .description('Analyze GitHub repositories to measure AI tooling impact on delivery speed')
    .version('1.0.0')
    .option('-r, --repos <repos>', 'Comma-separated list of repositories to analyze')
    .option('-o, --org <organization>', 'GitHub organization name')
    .option('-p, --period <preset>', 'Time period preset (weekly, monthly, quarterly, 6months, yearly)', 'quarterly')
    .option('-d, --days <days>', 'Custom number of days for current analysis period')
    .option('--compare-days <days>', 'Number of days for comparison period (defaults to same as current period)')
    .option('--gap-days <days>', 'Number of gap days between current and comparison periods', '0')
    .option('--output-dir <dir>', 'Output directory for reports', 'reports')
    .option('--discover-repos', 'Auto-discover repositories for the organization')
    .option('--discover-active', 'Only discover repositories with recent activity')
    .option('--setup', 'Run interactive setup to create configuration file')
    .parse();

  const options = program.opts();
  
  // Handle setup mode
  if (options.setup) {
    const { runSetup } = require('./setup');
    await runSetup();
    return;
  }
  
  // Load configuration
  const configManager = new ConfigManager();
  const config = configManager.loadConfig();
  
  if (!process.env.GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    console.log('💡 Create a .env file with: GITHUB_TOKEN=your_token_here');
    process.exit(1);
  }
  
  // Merge CLI options with config
  let organization = options.org || config.organization;
  let repositories = options.repos ? options.repos.split(',').map(r => r.trim()) : config.repositories;
  
  // Check if we need to discover repositories
  if (options.discoverRepos || options.discoverActive) {
    if (!organization) {
      console.error('❌ Organization name is required for repository discovery');
      console.log('💡 Use --org <organization> or run --setup to configure');
      process.exit(1);
    }
    
    console.log(`🔍 Discovering repositories for ${organization}...`);
    const githubClient = new GitHubClient();
    const discoveredRepos = await githubClient.listRepositories(organization, {
      excludeArchived: config.repositoryFilters.excludeArchived,
      excludeForks: config.repositoryFilters.excludeForks,
      minSize: config.repositoryFilters.minSize
    });
    
    if (options.discoverActive) {
      const activeRepos = [];
      for (const repo of discoveredRepos.slice(0, 20)) { // Limit to first 20 for activity check
        const activity = await githubClient.getRecentActivity(organization, repo.name);
        if (activity.recentCommits > config.repositoryFilters.minCommits) {
          activeRepos.push(repo);
        }
      }
      repositories = activeRepos.map(r => r.name);
      console.log(`📊 Found ${activeRepos.length} active repositories`);
    } else {
      repositories = discoveredRepos.map(r => r.name);
      console.log(`📊 Found ${repositories.length} repositories`);
    }
    
    if (repositories.length === 0) {
      console.error('❌ No repositories found matching criteria');
      process.exit(1);
    }
  }
  
  // Validate required parameters
  if (!organization) {
    console.error('❌ Organization name is required');
    console.log('💡 Use --org <organization> or run --setup to configure');
    process.exit(1);
  }
  
  if (!repositories || repositories.length === 0) {
    console.error('❌ At least one repository is required');
    console.log('💡 Use --repos <repo1,repo2> or --discover-repos or run --setup to configure');
    process.exit(1);
  }


  // Parse current period
  let currentPeriodDays;
  if (options.days) {
    currentPeriodDays = parseInt(options.days);
    if (isNaN(currentPeriodDays) || currentPeriodDays <= 0) {
      console.error('❌ Days must be a positive number');
      process.exit(1);
    }
  } else {
    const presets = getDateRangePresets();
    currentPeriodDays = presets[options.period];
    if (!currentPeriodDays) {
      console.error(`❌ Invalid period preset: ${options.period}`);
      console.log('Valid presets:', Object.keys(presets).join(', '));
      process.exit(1);
    }
  }

  // Parse comparison period
  let previousPeriodDays = currentPeriodDays; // Default to same as current
  if (options.compareDays) {
    previousPeriodDays = parseInt(options.compareDays);
    if (isNaN(previousPeriodDays) || previousPeriodDays <= 0) {
      console.error('❌ Compare days must be a positive number');
      process.exit(1);
    }
  }

  // Parse gap days
  let gapDays = 0;
  if (options.gapDays) {
    gapDays = parseInt(options.gapDays);
    if (isNaN(gapDays) || gapDays < 0) {
      console.error('❌ Gap days must be a non-negative number');
      process.exit(1);
    }
  }

  const analyzerOptions = {
    repositories,
    organization,
    currentPeriodDays,
    previousPeriodDays,
    gapDays,
    excludeRepositories: config.excludeRepositories,
    repositoryFilters: config.repositoryFilters
  };

  const analyzer = new AIDeliveryAnalyzer(analyzerOptions);
  
  try {
    const report = await analyzer.generateReport();
    
    const fs = require('fs');
    if (!fs.existsSync(options.outputDir)) {
      fs.mkdirSync(options.outputDir, { recursive: true });
    }
    
    const filename = `${options.outputDir}/ai-delivery-analysis-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.json`;
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    
    console.log(`\n💾 Full report saved to: ${filename}`);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = AIDeliveryAnalyzer;