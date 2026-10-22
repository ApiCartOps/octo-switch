---
description: Review a pull request (usage /gh-review-pr owner/repo number)
argument-hint: owner/repo number
---
Review the pull request given by $ARGUMENTS using the octoswitch MCP server. Call `gh_get_pr` with `include_diff: true`. Report correctness problems first, then risks and missing tests, citing file names. Do not post the review; show it to me and ask whether to post it with `gh_comment_issue`.
