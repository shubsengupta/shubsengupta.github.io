const CLAUDE_COAUTHOR = /co-authored-by:\s*(claude[^<\n]*)/gi;

export const isAiAssisted = (message) => /co-authored-by:.*claude/i.test(message ?? '');

// PR bodies get the Claude Code footer; squash commits keep the co-author trailer.
export const isAgentBuilt = (text) => /generated with \[?claude code|co-authored-by:.*claude/i.test(text ?? '');

export function bucketCommits(items) {
  const days = {};
  for (const { commit } of items) {
    const day = commit.author.date.slice(0, 10);
    const d = (days[day] ??= { count: 0, ai: 0 });
    d.count += 1;
    if (isAiAssisted(commit.message)) d.ai += 1;
  }
  return days;
}

export function bucketPRs(items) {
  const days = {};
  for (const pr of items) {
    const day = pr.created_at.slice(0, 10);
    const d = (days[day] ??= { count: 0, agent: 0 });
    d.count += 1;
    if (isAgentBuilt(pr.body)) d.agent += 1;
  }
  return days;
}

export function modelName(raw) {
  return raw.replace(/\(.*?\)/g, '').replace(/^claude\s+/i, '').trim();
}

// Per-month count of commits per Claude model, from co-author trailers.
export function bucketModels(items) {
  const months = {};
  for (const { commit } of items) {
    const month = commit.author.date.slice(0, 7);
    for (const m of commit.message.matchAll(CLAUDE_COAUTHOR)) {
      const name = modelName(m[1]);
      const bucket = (months[month] ??= {});
      bucket[name] = (bucket[name] ?? 0) + 1;
    }
  }
  return months;
}
