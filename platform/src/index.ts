import * as pulumi from "@pulumi/pulumi"
import * as postgres from "@pulumi/postgresql"
import * as vault from '@pulumi/vault'
import * as minio from "@pulumi/minio"

import {LayerOne, LayerOneExports, LayerTwo, LayerTwoExports} from "global/refs"
import {SprocketPostgresProvider} from "global/providers/SprocketPostgresProvider"
import {SprocketMinioProvider} from "global/providers/SprocketMinioProvider"


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
    vaultProvider: infrastructureVaultProvider,
    postgresHostname: LayerTwo.stack.requireOutput(LayerTwoExports.PostgresUrl) as pulumi.Output<string>
})

const minioProvider = new SprocketMinioProvider({
    vaultProvider: infrastructureVaultProvider,
    minioHostname: LayerTwo.stack.requireOutput(LayerTwoExports.MinioUrl) as pulumi.Output<string>
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

    minioProvider: minioProvider as minio.Provider,

    configRoot: `${__dirname}/config/${pulumi.getStack()}`,

    ingressNetworkId: LayerOne.stack.requireOutput(LayerOneExports.IngressNetwork) as pulumi.Output<string>,
    monitoringNetworkId: LayerTwo.stack.requireOutput(LayerTwoExports.MonitoringNetworkId) as pulumi.Output<string>,
})