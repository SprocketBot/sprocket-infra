import * as pulumi from "@pulumi/pulumi"
const config = new pulumi.Config()



export const HOSTNAME = config.get("hostname") ?? "spr.ocket.cloud";

export const CHATWOOT_SUBDOMAIN = "chatwoot";
