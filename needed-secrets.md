# Doppler Secrets Required for Sprocket Infrastructure

This document lists the secrets that need to be manually configured in your Doppler project. These secrets are consumed by the Pulumi infrastructure code to provision and configure the various services.

**Doppler Project Name:** `sprocket` (as configured in `platform/src/PlatformVault.ts` - now `PlatformDoppler.ts`)
**Doppler Config Name:** `infrastructure` (as configured in `global/providers/SprocketPostgresProvider.ts` and `global/providers/SprocketMinioProvider.ts`)

---

## Secrets List

1.  **`DOPPLER_TOKEN`**
    *   **Purpose:** This is the API token that Pulumi uses to authenticate with your Doppler account. It should be set as an environment variable (`DOPPLER_TOKEN`) in the environment where you run `pulumi up`, rather than directly in the Doppler project itself.

2.  **`JWT_SECRET`**
    *   **Purpose:** A secret key used for signing and verifying JSON Web Tokens (JWTs). This is crucial for user authentication and session management within the `core` service.

3.  **`S3_ACCESS_KEY`**
    *   **Purpose:** The access key for your Minio object storage instance. This key is used by various services (e.g., `image-generation-service`, `replay-parse-service`) to authenticate and interact with Minio for storing and retrieving files.

4.  **`S3_SECRET_KEY`**
    *   **Purpose:** The secret key for your Minio object storage instance, paired with `S3_ACCESS_KEY`.

5.  **`GOOGLE_CLIENT_ID`**
    *   **Purpose:** The client ID for Google OAuth. This is used by the `core` service to enable user authentication through Google accounts.

6.  **`GOOGLE_CLIENT_SECRET`**
    *   **Purpose:** The client secret for Google OAuth, paired with `GOOGLE_CLIENT_ID`.

7.  **`DISCORD_CLIENT_ID`**
    *   **Purpose:** The client ID for Discord OAuth. This is used by the `core` service to enable user authentication through Discord accounts.

8.  **`DISCORD_CLIENT_SECRET`**
    *   **Purpose:** The client secret for Discord OAuth, paired with `DISCORD_CLIENT_ID`.

9.  **`REDIS_PASSWORD`**
    *   **Purpose:** The password for the Redis instance. Services like `core`, `matchmaking-service`, `notification-service`, and `submission-service` use Redis for caching, job queues, and other data storage.

10. **`EPIC_CLIENT_ID`**
    *   **Purpose:** The client ID for the Epic Games API. This is likely used for integrations with Epic Games services, such as fetching user data or game information.

11. **`EPIC_CLIENT_SECRET`**
    *   **Purpose:** The client secret for the Epic Games API, paired with `EPIC_CLIENT_ID`.

12. **`STEAM_API_KEY`**
    *   **Purpose:** The API key for Steam. This is likely used for integrations with Steam services, such as fetching game statistics or user profiles.

13. **`CHATWOOT_HMAC_KEY`**
    *   **Purpose:** The HMAC key for Chatwoot. This is used for verifying webhook payloads or securing communication with your Chatwoot platform.

14. **`POSTGRES_PASSWORD`**
    *   **Purpose:** The password for the main PostgreSQL database. This is used by the `core` service and other applications to connect to the database.

15. **`DISCORD_BOT_TOKEN`**
    *   **Purpose:** The authentication token for your Discord bot. This allows the bot to connect to Discord and interact with the Discord API (e.g., sending messages, managing roles).

16. **`INFLUX_TOKEN`**
    *   **Purpose:** The authentication token for InfluxDB. This is used by the `server-analytics-service` to write time-series data to InfluxDB.

17. **`BALLCHASING_API_TOKEN`**
    *   **Purpose:** The API token for Ballchasing.com. This is used by the `replay-parse-service` to access and process replay data from Ballchasing.com.

18. **`POSTGRES_USERNAME`**
    *   **Purpose:** The username for the main PostgreSQL database. This is used by the `SprocketPostgresProvider` to configure the PostgreSQL provider within Pulumi.
