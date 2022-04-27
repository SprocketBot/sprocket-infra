import * as pulumi from "@pulumi/pulumi"
import * as postgres from "@pulumi/postgresql"
import * as vault from '@pulumi/vault'

import {LayerOne, LayerOneExports, LayerTwo, LayerTwoExports} from "global/refs"
import {SprocketPostgresProvider} from "global/providers/SprocketPostgresProvider"


import {Platform} from "./Platform";


const vaultProvider = new vault.Provider("VaultProvider", {
    address: LayerOne.stack.requireOutput(LayerOneExports.VaultAddress),
    token: LayerTwo.stack.requireOutput(LayerTwoExports.InfrastructureVaultToken)
})

const postgresProvider = new SprocketPostgresProvider({
    vaultProvider
})
// TODO: Build support for automatic variable interpolation in configuration files (i.e. rabbitmq host)
export const platform = new Platform(pulumi.getStack(), {
    vaultProvider,
    postgresProvider: postgresProvider as postgres.Provider,


    postgresHostname: LayerTwo.stack.requireOutput(LayerTwoExports.PostgresHostname) as pulumi.Output<string>,
    configRoot: `${__dirname}/config/${pulumi.getStack()}`,

    ingressNetworkId: LayerOne.stack.requireOutput(LayerOneExports.IngressNetwork) as pulumi.Output<string>,
    monitoringNetworkId: LayerTwo.stack.requireOutput(LayerTwoExports.MonitoringNetworkId) as pulumi.Output<string>,
})