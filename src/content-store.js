export const TQL = {
  set: (path, value) => ({ path, value }),
  batch: (operations) => operations,
};

export function applyContentUpdates(content, update) {
  const next = structuredClone(content);
  for (const { path, value } of Array.isArray(update) ? update : [update]) {
    const parts = path.split('.');
    if (parts.some(part => ['__proto__', 'constructor', 'prototype'].includes(part))) continue;
    let target = next;
    for (const part of parts.slice(0, -1)) target = target[part] ??= {};
    target[parts.at(-1)] = structuredClone(value);
  }
  return next;
}
