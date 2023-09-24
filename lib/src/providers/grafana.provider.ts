import * as grafana from "@lbrlabs/pulumi-grafana";
import * as vault from "@pulumi/vault";

import { VaultConstants } from "../constants";
import { GrafanaStackOutputs, GrafanaStackRef } from "../stack-refs";
import { getVaultProvider } from "./vault.provider";
import { UrlAvailable } from "../utils";

let provider: grafana.Provider;

export const getGrafanaProvider = () => {
  if (provider) return provider;
  if (GrafanaStackRef === null) throw new Error("GrafanaStackRef is null!");
  const adminCredsPath = GrafanaStackRef.getOutput(
    GrafanaStackOutputs.AdminCredsPath,
  );
  const grafanaUrl = GrafanaStackRef.getOutput(GrafanaStackOutputs.GrafanaUrl);

  const credentials = vault.kv.getSecretV2Output(
    {
      mount: VaultConstants.Backend.kv2,
      name: adminCredsPath,
    },
    { provider: getVaultProvider() },
  );

  provider = new grafana.Provider("grafana-provider", {
    url: grafanaUrl.apply(($url) => UrlAvailable(`https://${$url}`)),
    auth: credentials.apply(
      ($creds) => `${$creds.data.username}:${$creds.data.password}`,
    ),
  });

  return provider;
};
