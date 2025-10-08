# Vault Secrets Bootstrap

This directory contains scripts to bootstrap Vault with required secrets for the Sprocket platform.

## Setup

1. Copy the template file to create your secrets configuration:
   ```bash
   cp vault-secrets.env.template vault-secrets.env
   ```

2. Edit `vault-secrets.env` and fill in your actual secret values:
   - Get the `VAULT_TOKEN` from: `../global/services/vault/unseal-tokens/root_token.txt`
   - Set `VAULT_ADDR` to your Vault instance (e.g., `https://vault.yourdomain.com` or `http://vault.localhost`)
   - Fill in all OAuth credentials and API keys

3. Load the environment variables:
   ```bash
   source vault-secrets.env
   ```

4. Run the bootstrap script:
   ```bash
   ./bootstrap-vault-secrets.sh
   ```

## Required Secrets

The script will create the following secrets in Vault:

- `platform/{environment}/manual/oauth/google` - Google OAuth credentials (clientId, clientSecret)
- `platform/{environment}/manual/oauth/discord` - Discord OAuth credentials (client_id, client_secret)
- `platform/{environment}/manual/oauth/epic` - Epic OAuth credentials (clientId, clientSecret)
- `platform/{environment}/manual/oauth/steam` - Steam API credentials (apiKey)
- `platform/ballchasing` - Ballchasing API token (token)
- `platform/{environment}/chatwoot` - Chatwoot HMAC key (hmacKey)

Where `{environment}` defaults to `sprocket` or can be set via `VAULT_ENVIRONMENT`.

## Verification

After running the script, you can verify the secrets were created:

```bash
vault kv get secret/platform/sprocket/manual/oauth/google
vault kv get secret/platform/ballchasing
# etc.
```

## Security Notes

- **NEVER** commit `vault-secrets.env` to version control
- The `.gitignore` file is configured to exclude this file
- Store your actual secrets securely (e.g., in a password manager)
- Rotate credentials regularly
- Use environment-specific secrets for production vs development
