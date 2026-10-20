export function normalisedText(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function pageText(html: string) {
  return normalisedText(html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex: string, decimal: string) =>
      String.fromCodePoint(Number.parseInt(hex || decimal, hex ? 16 : 10))));
}

export function personRoleAppearsTogether(html: string, name: string, role: string) {
  const text = pageText(html);
  const person = normalisedText(name);
  const title = normalisedText(role);
  if (person.split(" ").length < 2 || person.length < 6 || !title || title.length < 4) return false;
  let index = text.indexOf(person);
  while (index >= 0) {
    if (text.slice(Math.max(0, index - 60), index + person.length + 60).includes(title)) return true;
    index = text.indexOf(person, index + person.length);
  }
  return false;
}
