# Team Health Monitor

A comprehensive GitHub analytics tool designed to measure engineering team velocity, code quality metrics, and the impact of development tools on delivery speed.

## Overview

This tool analyzes GitHub repositories to provide insights into team performance by comparing delivery metrics across time periods. Originally designed to measure AI coding tools impact, it now serves as a general-purpose team health monitoring solution.

## Key Metrics

1. **Cycle Time Trends** - PR creation to merge time
2. **Code Review Speed** - PR creation to approval time  
3. **Commit Frequency** - Development iteration cycles
4. **PR Size Trends** - Smaller, more frequent PRs indicate faster development

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Initial Setup** (Recommended)
   ```bash
   npm run setup
   ```
   This interactive setup will guide you through:
   - Creating configuration file
   - Setting up GitHub token
   - Configuring repositories to analyze

3. **Manual Configuration** (Alternative)
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env with your GitHub Personal Access Token
   # Token needs 'repo' and 'read:org' permissions
   ```

4. **Run Analysis**
   ```bash
   npm start              # Quarterly analysis (default)
   npm run weekly         # Weekly analysis  
   npm run monthly        # Monthly analysis
   npm run quarterly      # Quarterly analysis
   
   # Check API rate limits before large analyses
   npm run check-limits
   ```

## Usage Options

### Command Line Arguments

```bash
# Analyze specific repositories
node src/index.js --repos "web-app,api-service"

# Use different time periods
node src/index.js --period weekly     # Last 7 vs previous 7 days
node src/index.js --period monthly    # Last 30 vs previous 30 days
node src/index.js --period quarterly  # Last 90 vs previous 90 days (default)

# Custom time period (max 90 days)
node src/index.js --days 45           # Last 45 vs previous 45 days
node src/index.js --days 90           # Last 90 vs previous 90 days

# Custom comparison periods (max 90 days each)
node src/index.js --days 42 --compare-days 42    # Last 6 weeks vs previous 6 weeks
node src/index.js --days 30 --compare-days 90    # Last month vs previous 3 months
node src/index.js --days 14 --compare-days 14 --gap-days 7  # Last 2 weeks vs 2 weeks before (with 1 week gap)

# Different organization
node src/index.js --org "MyOrg" --repos "repo1,repo2"

# Custom output directory
node src/index.js --output-dir "./my-reports"

# Auto-discover all repositories for an organization
node src/index.js --org "mycompany" --discover-repos

# Discover only active repositories (with recent commits)
node src/index.js --org "mycompany" --discover-active

# Combined example
node src/index.js --repos "web-app,api-service" --days 42 --compare-days 42 --output-dir "./6week-reports"
```

### Available Options

- `--repos, -r`: Comma-separated list of repositories to analyze
- `--org, -o`: GitHub organization name
- `--period, -p`: Time period preset (weekly, monthly, quarterly)
- `--days, -d`: Custom number of days for current analysis period (max 90 days)
- `--compare-days`: Number of days for comparison period (max 90 days, defaults to same as current period)
- `--gap-days`: Number of gap days between current and comparison periods (default: 0)
- `--output-dir`: Output directory for reports (default: reports)
- `--discover-repos`: Auto-discover all repositories for the organization
- `--discover-active`: Only discover repositories with recent activity
- `--setup`: Run interactive setup to create configuration file
- `--check-limits`: Check current GitHub API rate limit status
- `--help`: Show help information

### Data Analysis Limits

**Maximum Time Period: 90 Days**
- All analysis periods are limited to 90 days maximum
- Both current and comparison periods respect this limit
- Use quarterly preset for maximum 90-day analysis

### Flexible Time Comparisons

The analyzer supports flexible time period comparisons within the 90-day limit:

**Same Period Length (Default)**:
```bash
node src/index.js --days 42    # Last 6 weeks vs previous 6 weeks
```

**Different Period Lengths**:
```bash
node src/index.js --days 30 --compare-days 60    # Last month vs previous 2 months
node src/index.js --days 14 --compare-days 28    # Last 2 weeks vs previous 4 weeks
```

**With Gap Between Periods**:
```bash
node src/index.js --days 30 --gap-days 15    # Last month vs month before (skip 2 weeks)
node src/index.js --days 14 --compare-days 14 --gap-days 7    # Last 2 weeks vs 2 weeks ago (skip 1 week)
```

**Real-World Examples**:
```bash
# Compare current sprint (2 weeks) with previous sprint
node src/index.js --days 14 --compare-days 14 --gap-days 0

# Compare last 6 weeks with 6 weeks before that
node src/index.js --days 42 --compare-days 42

# Compare current month with same month last quarter
node src/index.js --days 30 --compare-days 30 --gap-days 60
```

## Output

The analyzer provides:

- **Simple Summary**: "AI tooling impact: X% faster delivery"
- **Before/After Metrics**: Comparing current vs previous period
- **Top Contributors**: Fastest-improving developers/teams
- **Actionable Insights**: Recommendations for expanding AI adoption

## Example Output

```
📊 TEAM HEALTH MONITOR REPORT
=============================

📂 Repository: web-app
📈 Delivery performance: 23.4% faster delivery (significant improvement)

  Cycle Time (Hours): 45.2 → 34.6 (-23.4%) ↗️
  Review Time (Hours): 18.3 → 12.7 (-30.6%) ↗️
  PR Size (Changes): 234 → 189 (-19.2%) ↗️
  Total PRs: 67 → 89 (+32.8%) ↗️

🎯 OVERALL TEAM PERFORMANCE
==========================
Team velocity improvement: 18.7% faster delivery across all repositories

💡 INSIGHTS & RECOMMENDATIONS:
✅ Significant improvement detected! Consider:
  - Identifying what's working well to replicate success
  - Documenting best practices from high-performing periods
  - Sharing learnings with other teams
```

## Configuration

### Configuration

The tool supports multiple configuration methods:

1. **Interactive Setup** (Recommended)
   ```bash
   npm run setup
   ```

2. **Configuration File** (`config.json`)
   ```json
   {
     "organization": "your-org-name",
     "repositories": ["repo1", "repo2"],
     "defaultPeriod": "quarterly",
     "outputDirectory": "reports",
     "repositoryFilters": {
       "excludeArchived": true,
       "excludeForks": true,
       "minCommits": 10
     }
   }
   ```

3. **Environment Variables**
   ```bash
   GITHUB_ORG=your-organization
   GITHUB_REPOS=repo1,repo2,repo3
   ```

4. **Command Line Arguments**
   ```bash
   node src/index.js --org "mycompany" --repos "repo1,repo2"
   ```

### Time Period Presets
- **Weekly**: 7 days (good for sprint retrospectives)
- **Monthly**: 30 days (good for monthly reviews)
- **Quarterly**: 90 days (default, good for strategic planning)
- **6months**: 180 days (good for major initiative tracking)
- **Yearly**: 365 days (good for annual reviews)

### Repository Targeting

You can analyze specific repositories instead of all repositories:

```bash
# Single repository
node src/index.js --repos "web-app"

# Multiple repositories
node src/index.js --repos "web-app,api-service,mobile-app"

# Auto-discover all repositories
node src/index.js --org "mycompany" --discover-repos

# Auto-discover active repositories only
node src/index.js --org "mycompany" --discover-active
```

## Requirements

- Node.js 16+
- GitHub personal access token with repo access
- Access to your GitHub organization's repositories

## Understanding the Metrics

### Core Metrics Explained

- **Cycle Time**: Time from PR creation to merge (hours)
  - Measures overall development speed
  - Includes code review, revisions, and approval time
  - Lower is better (faster delivery)

- **Review Time**: Time from PR creation to first approval (hours)
  - Measures team responsiveness and review efficiency
  - Excludes time for addressing feedback
  - Lower is better (faster feedback)

- **PR Size**: Total code changes (additions + deletions)
  - Smaller PRs typically move faster and have fewer bugs
  - Tracked as average, median, and 95th percentile
  - Lower is generally better (more focused changes)

- **Commit Frequency**: Average commits per day
  - Measures development activity and iteration speed
  - Higher frequency often indicates more iterative development

### Statistical Analysis

The tool calculates:
- **Average (Mean)**: Overall trend indicator
- **Median**: Resistant to outliers, shows typical experience
- **95th Percentile (P95)**: Identifies worst-case scenarios
- **Improvement %**: Period-over-period comparison

### Impact Classification
- **Minimal Impact**: < 5% change
- **Moderate Impact**: 5-15% change  
- **Significant Impact**: > 15% change

## Report Output

### Console Output
Real-time analysis progress and summary with:
- Repository-by-repository breakdown
- Before/after metric comparisons
- Top contributors by PR volume
- Overall impact assessment
- Actionable recommendations

### JSON Reports
Detailed reports saved to `reports/` directory with structure:
```json
{
  "summary": {
    "totalRepositories": 5,
    "overallImprovementPercent": 18.7,
    "generatedAt": "2025-01-15T10:30:00.000Z"
  },
  "repositories": [
    {
      "repository": "web-app",
      "periods": {
        "current": {
          "start": "2024-10-01",
          "end": "2024-12-31",
          "prMetrics": {
            "totalPRs": 156,
            "cycleTime": {
              "avgHours": 34.2,
              "medianHours": 18.5,
              "p95Hours": 120.3
            },
            "topContributors": [...]
          }
        },
        "previous": {...}
      },
      "comparison": {
        "cycleTime": {
          "improvement": 23.4,
          "isImprovement": true
        },
        "overallImprovement": 18.7,
        "summary": "Team performance: 18.7% faster delivery (moderate improvement)"
      }
    }
  ]
}
```

## Rate Limiting & API Management

The tool includes comprehensive rate limiting protection to prevent hitting GitHub API limits:

### Built-in Rate Limiting Features

- **Conservative Limits**: Uses 4,500 requests/hour (vs GitHub's 5,000 limit)
- **Burst Protection**: Limits to 100 requests/minute to prevent overwhelming the API
- **Automatic Throttling**: Waits automatically when approaching limits
- **Smart Caching**: Caches responses for 4 hours to reduce API calls
- **Progress Feedback**: Shows warnings when approaching rate limits

### Checking Your Rate Limit Status

```bash
# Check current GitHub API rate limit status
npm run check-limits
# Or directly:
node src/index.js --check-limits
```

This displays:
- Core API: remaining/total requests and reset time
- Search API status  
- GraphQL API status

### Rate Limiting Behavior

The tool will:
1. **Cache First**: Check cache before making API requests
2. **Auto-Throttle**: Wait when burst limits are reached
3. **Smart Backoff**: Increase wait times if repeatedly hitting limits  
4. **Rate Limit Headers**: Monitor GitHub's rate limit headers in real-time
5. **Graceful Degradation**: Continue analysis even with temporary limits

### Tips for Large Analyses

- **Use Specific Repos**: `--repos "repo1,repo2"` instead of `--discover-repos`
- **Smaller Time Periods**: Use weekly/monthly instead of yearly analysis
- **Cache Benefits**: Re-running analysis uses cached data (faster, fewer API calls)
- **Off-Peak Hours**: Run during off-peak hours for better API availability

## Troubleshooting

### Common Issues

**❌ "GITHUB_TOKEN environment variable is required"**
- Create `.env` file with your GitHub Personal Access Token
- Ensure token has `repo` and `read:org` permissions

**❌ "Organization name is required"**
- Use `--org <organization>` flag or run `npm run setup`
- Verify you have access to the organization

**❌ "Maximum analysis period is 90 days"**
- Analysis periods are limited to 90 days for performance and API rate limiting
- Use `--period quarterly` for maximum 90-day analysis
- Break longer analyses into multiple 90-day periods

**❌ "No repositories found matching criteria"**
- Check organization name spelling
- Verify repositories exist and you have access
- Try `--discover-repos` to see all available repositories
- Reduce filtering with `--discover-active` if repositories seem inactive

**❌ "API rate limit exceeded"**
- GitHub API allows 5,000 requests/hour for authenticated users
- Large organizations may hit limits with `--discover-repos`
- Check current status with `node src/index.js --check-limits`
- Wait for reset time or use specific `--repos` instead of discovery
- Tool automatically throttles and waits when approaching limits

**❌ "Could not fetch details for PR #123"**
- Some PRs may be inaccessible due to permissions
- Tool continues analysis, skipping problematic PRs
- Consider excluding repositories with access issues

### Performance Considerations

- **Repository Size**: Large repositories (>1000 PRs) take longer to analyze
- **Time Periods**: Longer periods require more API calls
- **Discovery Mode**: `--discover-repos` makes additional API calls
- **Concurrent Analysis**: Tool processes repositories sequentially

### Data Quality

**Minimum Requirements for Reliable Analysis:**
- At least 20 merged PRs in each comparison period
- Repository active for the full analysis period
- Consistent team size (major team changes skew results)

**Interpreting Results:**
- Small sample sizes (< 20 PRs) may show misleading trends
- Seasonal effects (holidays, major releases) can impact metrics
- Consider external factors (team changes, major incidents, tool adoption dates)

### Configuration Validation

Run configuration check:
```bash
node -e "console.log('Config valid:', require('./src/config-manager.js').loadConfig())"
```

## Advanced Usage

### GitHub Token Permissions

Your Personal Access Token needs these scopes:
- `repo` - Access repositories, read/write PRs, commits, reviews
- `read:org` - Read organization membership and repositories

**Token Creation Steps:**
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token
3. Select required scopes: `repo`, `read:org`
4. Copy token to `.env` file

### Filtering Repositories

Repository discovery filters in `config.json`:
```json
{
  "repositoryFilters": {
    "excludeArchived": true,     // Skip archived repos
    "excludeForks": true,        // Skip forked repos  
    "minCommits": 10,            // Minimum commit count
    "minSize": 100               // Minimum repository size (KB)
  }
}
```

### Environment Variables

All configuration options can be set via environment variables:
```bash
GITHUB_ORG=mycompany
GITHUB_REPOS=repo1,repo2,repo3
GITHUB_EXCLUDE_REPOS=archived-repo
GITHUB_OUTPUT_DIR=custom-reports
```

### Automated Monitoring

Schedule regular team health monitoring with cron:
```bash
# Weekly analysis every Monday at 9 AM
0 9 * * 1 cd /path/to/team-health-monitor && npm run weekly

# Monthly analysis on first day of month
0 9 1 * * cd /path/to/team-health-monitor && npm run monthly
```

## Prerequisites

- **Node.js 16+**
- **GitHub Personal Access Token** with `repo` and `read:org` permissions
- **Access** to your GitHub organization's repositories
- **Minimum Data:** Repositories should have at least 10 commits and some merged PRs for meaningful analysis

## Use Cases

### Team Performance Monitoring
- Track sprint-over-sprint improvements in cycle time
- Identify bottlenecks in code review processes  
- Monitor team velocity trends over time
- Compare performance across different teams/repositories

### Process Optimization
- Measure impact of process changes (new tools, workflows, practices)
- Identify optimal PR size and review patterns
- Track deployment frequency and lead times
- Analyze contributor productivity patterns

### Strategic Planning
- Demonstrate team velocity improvements to stakeholders
- Support resource allocation decisions with data
- Track progress toward engineering velocity goals
- Identify high-performing practices to scale across teams