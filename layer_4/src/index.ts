import {
  LayerOne, LayerOneExports,
  LayerTwo, LayerTwoExports,
  Platforms, PlatformExports
} from "global/refs"
import { Tooljet } from "global/services"
import {SprocketPostgresProvider} from "global/providers/SprocketPostgresProvider"

import * as pulumi from "@pulumi/pulumi"
import * as vault from "@pulumi/vault"
import { GrafanaBootstrap } from './grafana/GrafanaBootstrap';
import { PlatformTelegraf } from './PlatformTelegraf';


const influxToken = LayerTwo.stack.requireOutput(LayerTwoExports.InfluxDbToken) as pulumi.Output<string>
const monitoringNetworkId = LayerTwo.stack.requireOutput(LayerTwoExports.MonitoringNetworkId) as pulumi.Output<string>
const postgresHostname = LayerTwo.stack.requireOutput(LayerTwoExports.PostgresUrl) as pulumi.Output<string>
const postgresNetworkId = LayerTwo.stack.requireOutput(LayerTwoExports.PostgresNetworkId) as pulumi.Output<string>
const ingressNetworkdId = LayerOne.stack.requireOutput(LayerOneExports.IngressNetwork) as pulumi.Output<string>


const vaultProvider = new vault.Provider('VaultProvider', {
  address: LayerOne.stack.requireOutput(LayerOneExports.VaultAddress),
  token: LayerTwo.stack.requireOutput(LayerTwoExports.InfrastructureVaultToken)
});
const postgresProvider = new SprocketPostgresProvider({
  vaultProvider: vaultProvider,
  postgresHostname: postgresHostname
})



export * from "./GatusPages"

// TODO: Build dashboards
export const grafanaBootstrap = new GrafanaBootstrap("grafana-content", {})

// Telegraf for platform redis & rmq
console.log(monitoringNetworkId)
export const platformTelegraf = PlatformTelegraf(vaultProvider, influxToken, monitoringNetworkId)

export const tooljet = new Tooljet(`tooljet`, {
  providers: {
    vault: vaultProvider,
    postgres: postgresProvider
  },
  postgresHostname: postgresHostname,
  postgresNetworkId: postgresNetworkId,
  ingressNetworkId: ingressNetworkdId,
  smtp: {
    host: 'smtp.sendgrid.net',
    password: vault.generic.getSecretOutput({ path: 'infrastructure/smtp' }, { provider: vaultProvider }).apply(s => s.data['password']) as pulumi.Output<string>,
    port: 587,
    username: 'apikey'
  },
})
