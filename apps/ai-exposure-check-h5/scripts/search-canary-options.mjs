export function readProviderArg(args, providerIds) {
  const argument = args.find((item) => item.startsWith('--providers='));
  if (!argument) return [...providerIds];
  const values = splitValues(argument, '--providers=');
  const invalid = values.filter((value) => !providerIds.includes(value));
  if (invalid.length > 0) throw new Error(`unknown providers: ${invalid.join(', ')}`);
  return values;
}

export function selectCases(args, cases) {
  const argument = args.find((item) => item.startsWith('--cases='));
  if (!argument) return [...cases];
  const requestedIds = splitValues(argument, '--cases=');
  const byId = new Map(cases.map((item) => [item.id, item]));
  const invalid = requestedIds.filter((id) => !byId.has(id));
  if (invalid.length > 0) throw new Error(`unknown cases: ${invalid.join(', ')}`);
  return requestedIds.map((id) => byId.get(id));
}

function splitValues(argument, prefix) {
  return [...new Set(argument.slice(prefix.length).split(',').map((item) => item.trim()).filter(Boolean))];
}
