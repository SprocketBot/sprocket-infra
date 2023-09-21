import * as grafana from "@lbrlabs/pulumi-grafana";
import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";

import { buildUrn, URN_TYPE, VaultConstants } from "@sprocketbot/infra-lib";

export class GrafanaAlerting extends pulumi.ComponentResource {
  constructor(name: string, args: {}, opts?: pulumi.ComponentResourceOptions) {
    super(
      buildUrn(URN_TYPE.LogicalGroup, "GrafanaAlerting", name),
      name,
      {},
      opts,
    );

    const discordWebhookUrl = vault.kv.getSecretV2Output(
      {
        name: "maintainer/manual/discord-webhooks",
        mount: VaultConstants.Backend.kv2,
      },
      { parent: this },
    );

    const contact = new grafana.ContactPoint(
      "contact-point",
      {
        discords: discordWebhookUrl.apply(($webhooks) => [
          { url: $webhooks.data.support, useDiscordUsername: true },
        ]),
        emails: [
          {
            singleEmail: true,
            addresses: ["admin@sprocket.gg"],
          },
        ],
      },
      { parent: this },
    );
  }
}
