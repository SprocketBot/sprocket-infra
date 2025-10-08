import * as pulumi from "@pulumi/pulumi"
import * as postgres from "@pulumi/postgresql"
import * as vault from '@pulumi/vault'
import * as aws from "@pulumi/aws"

import { LayerOne, LayerOneExports, LayerTwo, LayerTwoExports } from "global/refs"
import { SprocketPostgresProvider } from "global/providers/SprocketPostgresProvider"
import { SprocketS3Provider } from "global/providers/SprocketS3Provider"


import { Platform } from "./Platform";

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

const s3Provider = new SprocketS3Provider({
    vaultProvider: infrastructureVaultProvider,
    s3Endpoint: LayerTwo.stack.requireOutput(LayerTwoExports.MinioUrl) as pulumi.Output<string>
})

//const n8nNetworkId = LayerTwo.stack.requireOutput(LayerTwoExports.N8nNetwork) as pulumi.Output<string>

export const platform = new Platform(pulumi.getStack(), {
    vault: {
        infrastructure: infrastructureVaultProvider,
        platform: platformVaultProvider
    },
    postgresProvider: postgresProvider as postgres.Provider,
    //n8nNetworkId,
    postgresHostname: LayerTwo.stack.requireOutput(LayerTwoExports.PostgresHostname) as pulumi.Output<string>,

    s3Provider: s3Provider as aws.Provider,
    s3Endpoint: LayerTwo.stack.requireOutput(LayerTwoExports.MinioUrl) as pulumi.Output<string>,

    configRoot: `${__dirname}/config`,

    ingressNetworkId: LayerOne.stack.requireOutput(LayerOneExports.IngressNetwork) as pulumi.Output<string>,
    monitoringNetworkId: LayerTwo.stack.requireOutput(LayerTwoExports.MonitoringNetworkId) as pulumi.Output<string>,
})
