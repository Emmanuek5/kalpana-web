/**
 * Generate a random subdomain
 */
export function generateSubdomain(): string {
  const adjectives = [
    "happy",
    "clever",
    "bright",
    "swift",
    "calm",
    "bold",
    "wise",
    "kind",
    "cool",
    "neat",
  ];

  const nouns = [
    "app",
    "site",
    "web",
    "cloud",
    "dev",
    "hub",
    "lab",
    "zone",
    "space",
    "port",
  ];

  const randomAdjective =
    adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNum = Math.floor(Math.random() * 9999);

  return `${randomAdjective}-${randomNoun}-${randomNum}`;
}

/**
 * Validate subdomain format
 */
export function isValidSubdomain(subdomain: string): boolean {
  // Subdomain must be 3-63 characters
  // Can only contain lowercase letters, numbers, and hyphens
  // Cannot start or end with a hyphen
  const regex = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;
  return regex.test(subdomain);
}