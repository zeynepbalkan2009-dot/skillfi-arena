export function normalizeGuildSlug(value: string): string {
  return value.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

export function validateGuildInput(body: { name?: string; description?: string; emblem?: string }) {
  const name = body.name?.trim() ?? "";
  const description = body.description?.trim() ?? "";
  const emblem = body.emblem?.trim() || "⬢";
  const slug = normalizeGuildSlug(name);
  if (name.length < 3 || name.length > 48 || slug.length < 3) throw new Error("Guild name must be 3-48 characters.");
  if (description.length > 280) throw new Error("Guild description must be 280 characters or fewer.");
  if (emblem.length > 4) throw new Error("Choose a single emblem.");
  return { name, slug, description, emblem };
}
