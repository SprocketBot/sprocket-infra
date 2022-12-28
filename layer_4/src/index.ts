
import {
  LayerOne, LayerOneExports,
  LayerTwo, LayerTwoExports,
  Platforms, PlatformExports
} from "global/refs"

import * as pulumi from "@pulumi/pulumi"
import * as vault from "@pulumi/vault"
import { GrafanaBootstrap } from './grafana/GrafanaBootstrap';
import { PlatformTelegraf } from './PlatformTelegraf';

const influxToken = LayerTwo.stack.requireOutput(LayerTwoExports.InfluxDbToken) as pulumi.Output<string>
const monitoringNetworkId = LayerTwo.stack.requireOutput(LayerTwoExports.MonitoringNetworkId) as pulumi.Output<string>

const vaultProvider = new vault.Provider('VaultProvider', {
  address: LayerOne.stack.requireOutput(LayerOneExports.VaultAddress),
  token: LayerTwo.stack.requireOutput(LayerTwoExports.InfrastructureVaultToken)
});


export * from "./GatusPages"

// TODO: Build dashboards
export const grafanaBootstrap = new GrafanaBootstrap("grafana-content", {})

// Telegraf for platform redis & rmq

export const platformTelegraf = PlatformTelegraf(vaultProvider, influxToken, monitoringNetworkId)
