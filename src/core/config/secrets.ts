// Secret loading — reads from env vars.
// For production, integrate with Azure Key Vault or similar.
export function getSecret(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing secret: ${key}`);
  return val;
}
