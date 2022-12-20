import {Gatus} from "global/services/gatus"
import {Telegraf} from "global/services/telegraf"
import {
  LayerOne, LayerOneExports,
  LayerTwo, LayerTwoExports
} from "global/refs"
import * as pulumi from "@pulumi/pulumi"
import * as vault from "@pulumi/vault"
import { GrafanaBootstrap } from './grafana/GrafanaBootstrap';

const ingressNetworkId = LayerOne.stack.requireOutput(LayerOneExports.IngressNetwork) as pulumi.Output<string>
const influxToken = LayerTwo.stack.requireOutput(LayerTwoExports.InfluxDbToken) as pulumi.Output<string>
const monitoringNetworkId = LayerTwo.stack.requireOutput(LayerTwoExports.MonitoringNetworkId) as pulumi.Output<string>

const vaultProvider = new vault.Provider('VaultProvider', {
  address: LayerOne.stack.requireOutput(LayerOneExports.VaultAddress),
  token: LayerOne.stack.requireOutput(LayerTwoExports.InfrastructureVaultToken)
});

// TODO: Config File w/ Templating
export const publicGatus = new Gatus("public", {ingressNetworkId, configFilePath: `${__dirname}/config/gatus/public.yml`})
export const internalGatus = new Gatus("internal", {ingressNetworkId, configFilePath: `${__dirname}/config/gatus/public.yml`})

// TODO: Build dashboards
export const grafanaBootstrap = new GrafanaBootstrap("default", {})

// Telegraf for platform redis & rmq
export const platformTelegraf = new Telegraf("platform", {
  additionalEnvironmentVariables: { },
  additionalNetworkIds: [],
  configFilePath: `${__dirname}/config/telegraf/telegraf.conf`,
  influxToken,
  monitoringNetworkId,
  providers: { vault: vaultProvider }
})
