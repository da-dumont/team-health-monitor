# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Running the Analysis
- `npm start` - Run quarterly analysis (default 90 days)
- `npm run dev` - Run with nodemon for development
- `npm run setup` - Interactive setup wizard (recommended for first-time users)
- `npm run weekly` - Weekly analysis (7 days)
- `npm run monthly` - Monthly analysis (30 days) 
- `npm run quarterly` - Quarterly analysis (90 days)
- `npm run migrate` - Migrate existing configuration

### Custom Analysis Commands
- `node src/index.js --repos "web-app,api-service"` - Analyze specific repositories
- `node src/index.js --org "mycompany" --discover-repos` - Auto-discover all repositories
- `node src/index.js --org "mycompany" --discover-active` - Auto-discover active repositories
- `node src/index.js --period weekly` - Use time period presets
- `node src/index.js --days 42 --compare-days 42` - Custom time periods
- `node src/index.js --days 30 --gap-days 15` - Add gap between comparison periods
- `node src/index.js --org "MyOrg" --repos "repo1,repo2"` - Different organization
- `node src/index.js --output-dir "./my-reports"` - Custom output directory

### Setup Commands
- `npm install` - Install dependencies
- `cp .env.example .env` - Set up environment file (requires GITHUB_TOKEN)

## Architecture Overview

This is a GitHub analytics tool designed to measure the impact of AI coding tools on engineering delivery speed by comparing metrics across time periods.

### Core Components

**AIDeliveryAnalyzer** (`src/index.js`): Main orchestration class that:
- Manages CLI argument parsing and validation
- Coordinates analysis across multiple repositories
- Handles time period calculations with flexible comparison windows
- Generates formatted console reports and JSON output files

**GitHubClient** (`src/github-client.js`): GitHub API wrapper that:
- Fetches pull requests, reviews, and commits using @octokit/rest
- Handles pagination and rate limiting
- Filters data by time periods

**MetricsAnalyzer** (`src/metrics-analyzer.js`): Core analytics engine that:
- Calculates cycle time (PR creation to merge)
- Measures review time (PR creation to first approval)
- Analyzes PR size metrics (additions, deletions, changed files)
- Computes commit frequency and contributor statistics
- Performs period-over-period comparisons

### Key Metrics Tracked
- **Cycle Time**: PR creation to merge time (hours)
- **Review Speed**: PR creation to approval time (hours) 
- **PR Size**: Code changes (additions + deletions)
- **Commit Frequency**: Daily commit rates
- **Contributor Activity**: Top contributors by PR volume and speed

### Data Flow
1. CLI parses arguments and validates time periods
2. GitHubClient fetches raw data from GitHub API for each repository
3. MetricsAnalyzer processes PRs and commits into structured metrics
4. Analyzer compares current vs previous periods to calculate improvements
5. Results are formatted for console display and saved as JSON reports

### Configuration
- **Multiple Config Sources**: config.json > environment variables > CLI arguments
- **Interactive Setup**: `npm run setup` guides you through configuration
- **Repository Discovery**: Auto-discover repositories with filtering options
- **Time Period Presets**: weekly (7d), monthly (30d), quarterly (90d), 6months (180d), yearly (365d)
- **Environment**: Requires GITHUB_TOKEN in .env file
- **Output**: Reports saved to `reports/` directory by default

### Time Period Flexibility
The tool supports sophisticated time comparisons:
- Same period lengths (e.g., last 30 days vs previous 30 days)  
- Different period lengths (e.g., last 30 days vs previous 60 days)
- Gap periods between comparisons (e.g., skip weekends or deployment freezes)