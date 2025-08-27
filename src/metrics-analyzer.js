const { differenceInHours, differenceInDays } = require('date-fns');

class MetricsAnalyzer {
  constructor() {
    this.metrics = {
      cycleTime: [],
      reviewTime: [],
      commitFrequency: [],
      prSize: []
    };
  }

  analyzePullRequest(pr, reviews) {
    const createdAt = new Date(pr.created_at);
    const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;
    
    if (!mergedAt) return null;

    const cycleTimeHours = differenceInHours(mergedAt, createdAt);
    
    const firstApprovalReview = reviews
      .filter(review => review.state === 'APPROVED')
      .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at))[0];
    
    const reviewTimeHours = firstApprovalReview 
      ? differenceInHours(new Date(firstApprovalReview.submitted_at), createdAt)
      : null;

    const prSizeMetric = {
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      totalChanges: pr.additions + pr.deletions
    };

    return {
      number: pr.number,
      title: pr.title,
      author: pr.user.login,
      createdAt,
      mergedAt,
      cycleTimeHours,
      reviewTimeHours,
      prSize: prSizeMetric,
      labels: pr.labels.map(label => label.name)
    };
  }

  analyzeCommitFrequency(commits, periodDays) {
    const commitsByDay = {};
    
    commits.forEach(commit => {
      const date = new Date(commit.commit.author.date);
      const dayKey = date.toISOString().split('T')[0];
      
      if (!commitsByDay[dayKey]) {
        commitsByDay[dayKey] = {
          count: 0,
          authors: new Set()
        };
      }
      
      commitsByDay[dayKey].count++;
      commitsByDay[dayKey].authors.add(commit.commit.author.name);
    });

    const totalCommits = commits.length;
    const activeDays = Object.keys(commitsByDay).length;
    const avgCommitsPerDay = totalCommits / periodDays;
    const avgCommitsPerActiveDay = activeDays > 0 ? totalCommits / activeDays : 0;

    return {
      totalCommits,
      activeDays,
      avgCommitsPerDay,
      avgCommitsPerActiveDay,
      commitsByDay
    };
  }

  calculateMetricsSummary(prMetrics) {
    if (prMetrics.length === 0) return null;

    const cycleTimeHours = prMetrics
      .filter(pr => pr.cycleTimeHours !== null)
      .map(pr => pr.cycleTimeHours);

    const reviewTimeHours = prMetrics
      .filter(pr => pr.reviewTimeHours !== null)
      .map(pr => pr.reviewTimeHours);

    const prSizes = prMetrics.map(pr => pr.prSize.totalChanges);

    return {
      totalPRs: prMetrics.length,
      cycleTime: {
        avgHours: this.average(cycleTimeHours),
        medianHours: this.median(cycleTimeHours),
        p95Hours: this.percentile(cycleTimeHours, 95),
        count: cycleTimeHours.length
      },
      reviewTime: {
        avgHours: this.average(reviewTimeHours),
        medianHours: this.median(reviewTimeHours),
        p95Hours: this.percentile(reviewTimeHours, 95),
        count: reviewTimeHours.length
      },
      prSize: {
        avgChanges: this.average(prSizes),
        medianChanges: this.median(prSizes),
        p95Changes: this.percentile(prSizes, 95)
      },
      topContributors: this.getTopContributors(prMetrics)
    };
  }

  getTopContributors(prMetrics) {
    const contributors = {};
    
    prMetrics.forEach(pr => {
      if (!contributors[pr.author]) {
        contributors[pr.author] = {
          totalPRs: 0,
          avgCycleTime: 0,
          avgReviewTime: 0,
          cycleTimeHours: [],
          reviewTimeHours: []
        };
      }
      
      contributors[pr.author].totalPRs++;
      if (pr.cycleTimeHours !== null) {
        contributors[pr.author].cycleTimeHours.push(pr.cycleTimeHours);
      }
      if (pr.reviewTimeHours !== null) {
        contributors[pr.author].reviewTimeHours.push(pr.reviewTimeHours);
      }
    });

    Object.keys(contributors).forEach(author => {
      const contributor = contributors[author];
      contributor.avgCycleTime = this.average(contributor.cycleTimeHours);
      contributor.avgReviewTime = this.average(contributor.reviewTimeHours);
    });

    return Object.entries(contributors)
      .sort((a, b) => b[1].totalPRs - a[1].totalPRs)
      .slice(0, 10)
      .map(([author, stats]) => ({
        author,
        ...stats,
        cycleTimeHours: undefined,
        reviewTimeHours: undefined
      }));
  }

  comparePeriors(currentPeriod, previousPeriod) {
    const comparison = {
      cycleTime: this.calculateImprovement(
        previousPeriod?.cycleTime?.avgHours,
        currentPeriod?.cycleTime?.avgHours
      ),
      reviewTime: this.calculateImprovement(
        previousPeriod?.reviewTime?.avgHours,
        currentPeriod?.reviewTime?.avgHours
      ),
      prSize: this.calculateImprovement(
        previousPeriod?.prSize?.avgChanges,
        currentPeriod?.prSize?.avgChanges,
        true // Lower is better for PR size
      ),
      totalPRs: this.calculateImprovement(
        previousPeriod?.totalPRs,
        currentPeriod?.totalPRs,
        false // Higher is better for PR count
      )
    };

    const overallImprovement = this.calculateOverallImprovement(comparison);

    return {
      ...comparison,
      overallImprovement,
      summary: this.generateSummary(comparison, overallImprovement)
    };
  }

  calculateImprovement(oldValue, newValue, lowerIsBetter = true) {
    if (!oldValue || !newValue) return null;
    
    const percentChange = ((newValue - oldValue) / oldValue) * 100;
    const improvement = lowerIsBetter ? -percentChange : percentChange;
    
    return {
      oldValue,
      newValue,
      percentChange,
      improvement,
      isImprovement: improvement > 0
    };
  }

  calculateOverallImprovement(comparison) {
    const improvements = Object.values(comparison)
      .filter(comp => comp && comp.improvement !== null)
      .map(comp => comp.improvement);
    
    if (improvements.length === 0) return 0;
    
    return this.average(improvements);
  }

  generateSummary(comparison, overallImprovement) {
    const direction = overallImprovement > 0 ? 'faster' : 'slower';
    const magnitude = Math.abs(overallImprovement);
    
    let summary = `AI tooling impact: ${magnitude.toFixed(1)}% ${direction} delivery`;
    
    if (magnitude < 5) {
      summary += ' (minimal impact)';
    } else if (magnitude < 15) {
      summary += ' (moderate impact)';
    } else {
      summary += ' (significant impact)';
    }
    
    return summary;
  }

  average(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  median(arr) {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[middle - 1] + sorted[middle]) / 2 
      : sorted[middle];
  }

  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

module.exports = MetricsAnalyzer;