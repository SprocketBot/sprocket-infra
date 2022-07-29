import * as pulumi from "@pulumi/pulumi"
const config = new pulumi.Config()



export const HOSTNAME = config.get("hostname") ?? "spr.ocket.cloud";

export const CHATWOOT_SUBDOMAIN = "chatwoot";

export const DEV_CHATWOOT_WEBSITE_TOKEN = "2fADAgL8W9JVvwAAp7u9mqGC";

export const STAGING_CHATWOOT_WEBSITE_TOKEN = DEV_CHATWOOT_WEBSITE_TOKEN;

export const PRODUCTION_CHATWOOT_WEBSITE_TOKEN = "gv7YSGqACQkEfPdJ7Bt39Fi8";
