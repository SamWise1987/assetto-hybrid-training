interface TemplateActivity {
  date: string;
  templateId: string;
}

export function countUniqueMatchedExternal(input: {
  completedWorkouts: readonly TemplateActivity[];
  matchedExternal: readonly TemplateActivity[];
  fromDate: string;
  toDate?: string;
}) {
  const inRange = (date: string) => date >= input.fromDate && (!input.toDate || date <= input.toDate);
  const completedKeys = new Set(input.completedWorkouts
    .filter((item) => inRange(item.date))
    .map((item) => `${item.date}:${item.templateId}`));
  const countedExternalKeys = new Set<string>();

  return input.matchedExternal.filter((item) => {
    if (!inRange(item.date)) return false;
    const key = `${item.date}:${item.templateId}`;
    if (completedKeys.has(key) || countedExternalKeys.has(key)) return false;
    countedExternalKeys.add(key);
    return true;
  }).length;
}
