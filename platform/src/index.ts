import * as pulumi from "@pulumi/pulumi"
import * as postgres from "@pulumi/postgresql"
import * as vault from '@pulumi/vault'

import {LayerOne, LayerOneExports, LayerTwo, LayerTwoExports} from "global/refs"
import {SprocketPostgresProvider} from "global/providers/SprocketPostgresProvider"


import {Platform} from "./Platform";


const infrastructureVaultProvider = new vault.Provider("InfrastructureVaultProvider", {
    address: LayerOne.stack.requireOutput(LayerOneExports.VaultAddress),
    token: LayerTwo.stack.requireOutput(LayerTwoExports.InfrastructureVaultToken)
})

const platformVaultProvider = new vault.Provider("PlatformVaultProvider", {
    address: LayerOne.stack.requireOutput(LayerOneExports.VaultAddress),
    token: LayerTwo.stack.requireOutput(LayerTwoExports.PlatformVaultToken)
})

const postgresProvider = new SprocketPostgresProvider({
    vaultProvider: infrastructureVaultProvider
})

const postgresNetworkId = LayerTwo.stack.requireOutput(LayerTwoExports.PostgresNetworkId) as pulumi.Output<string>

export const platform = new Platform(pulumi.getStack(), {
    vault: {
        infrastructure: infrastructureVaultProvider,
        platform: platformVaultProvider
    },
    postgresProvider: postgresProvider as postgres.Provider,
    postgresNetworkId,
    postgresHostname: LayerTwo.stack.requireOutput(LayerTwoExports.PostgresHostname) as pulumi.Output<string>,

    configRoot: `${__dirname}/config/${pulumi.getStack()}`,

    ingressNetworkId: LayerOne.stack.requireOutput(LayerOneExports.IngressNetwork) as pulumi.Output<string>,
    monitoringNetworkId: LayerTwo.stack.requireOutput(LayerTwoExports.MonitoringNetworkId) as pulumi.Output<string>,
})