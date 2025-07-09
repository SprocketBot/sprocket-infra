

import os
import requests
import secrets
import string

DOPPLER_API_BASE_URL = "https://api.doppler.com/v3"
DOPPLER_PROJECT = "sprocket"
DOPPLER_CONFIG = "dev"

def generate_random_string(length=32):
    """Generate a random string of specified length."""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    return ''.join(secrets.choice(alphabet) for i in range(length))

def create_doppler_secret(name, value):
    """Create or update a secret in Doppler."""
    headers = {
        "Authorization": f"Bearer {os.environ.get('DOPPLER_TOKEN')}",
        "Content-Type": "application/json"
    }
    url = f"{DOPPLER_API_BASE_URL}/configs/config/secrets"
    payload = {
        "project": DOPPLER_PROJECT,
        "config": DOPPLER_CONFIG,
        "secrets": {
                f'{name}': value,
        }
    }
    print(payload)
    response = requests.post(url, headers=headers, json=payload)
    response.raise_for_status()
    print(f"Successfully set secret: {name}")

def main():
    if not os.environ.get("DOPPLER_TOKEN"):
        print("Error: DOPPLER_TOKEN environment variable not set.")
        print("Please set it before running the script: export DOPPLER_TOKEN='your_doppler_api_token'")
        exit(1)

    secrets_to_create = {
        "JWT_SECRET": generate_random_string(),
        "S3_ACCESS_KEY": generate_random_string(),
        "S3_SECRET_KEY": generate_random_string(),
        "GOOGLE_CLIENT_ID": "your_google_client_id",
        "GOOGLE_CLIENT_SECRET": "your_google_client_secret",
        "DISCORD_CLIENT_ID": "your_discord_client_id",
        "DISCORD_CLIENT_SECRET": "your_discord_client_secret",
        "REDIS_PASSWORD": generate_random_string(),
        "EPIC_CLIENT_ID": "your_epic_client_id",
        "EPIC_CLIENT_SECRET": "your_epic_client_secret",
        "STEAM_API_KEY": "your_steam_api_key",
        "CHATWOOT_HMAC_KEY": generate_random_string(),
        "POSTGRES_PASSWORD": generate_random_string(),
        "DISCORD_BOT_TOKEN": "your_discord_bot_token",
        "INFLUX_TOKEN": generate_random_string(),
        "BALLCHASING_API_TOKEN": "your_ballchasing_api_token",
        "POSTGRES_USERNAME": "sprocket_user"
    }

    for name, value in secrets_to_create.items():
        try:
            create_doppler_secret(name, value)
        except requests.exceptions.RequestException as e:
            print(f"Error setting secret {name}: {e}")
            if e.response:
                print(f"Response: {e.response.text}")
            exit(1)

    print("\nAll specified secrets have been processed.")
    print("Remember to replace placeholder values (e.g., 'your_google_client_id') with actual credentials in Doppler.")

if __name__ == "__main__":
    main()

