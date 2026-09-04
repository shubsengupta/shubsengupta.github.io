export const isAiAssisted = (message) => /co-authored-by:.*claude/i.test(message ?? '');

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
