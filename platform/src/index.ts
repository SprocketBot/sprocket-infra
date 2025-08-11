import * as pulumi from "@pulumi/pulumi"
import * as postgres from "@pulumi/postgresql"

import * as minio from "@pulumi/minio"

import {LayerOne, LayerOneExports, LayerTwo, LayerTwoExports} from "global/refs"
import {SprocketPostgresProvider} from "global/providers/SprocketPostgresProvider"
import {SprocketMinioProvider} from "global/providers/SprocketMinioProvider"
import * as doppler from "@pulumi/doppler"


import {Platform} from "./Platform";



const dopplerProvider = new doppler.Provider("DopplerProvider", {
    token: pulumi.secret(process.env.DOPPLER_TOKEN)
})

const postgresNetworkId = LayerTwo.stack.requireOutput(LayerTwoExports.PostgresNetworkId) as pulumi.Output<string>
const n8nNetworkId = LayerTwo.stack.requireOutput(LayerTwoExports.N8nNetwork) as pulumi.Output<string>

const postgresProvider = new SprocketPostgresProvider({
    dopplerProvider: dopplerProvider,
    postgresHostname: LayerTwo.stack.requireOutput(LayerTwoExports.PostgresUrl) as pulumi.Output<string>
})

const minioProvider = new SprocketMinioProvider({
    dopplerProvider: dopplerProvider,
    minioHostname: LayerTwo.stack.requireOutput(LayerTwoExports.MinioUrl) as pulumi.Output<string>
})

const config = new pulumi.Config()

export const platform = new Platform(pulumi.getStack(), {
    dopplerProvider: dopplerProvider,
    postgresProvider: postgresProvider as postgres.Provider,
    postgresNetworkId,
    n8nNetworkId,
    postgresHostname: LayerTwo.stack.requireOutput(LayerTwoExports.PostgresHostname) as pulumi.Output<string>,

    minioProvider: minioProvider as minio.Provider,

    configRoot: `${__dirname}/config`,

    ingressNetworkId: LayerOne.stack.requireOutput(LayerOneExports.IngressNetwork) as pulumi.Output<string>,
    monitoringNetworkId: LayerTwo.stack.requireOutput(LayerTwoExports.MonitoringNetworkId) as pulumi.Output<string>,

    // DigitalOcean configuration
    useDigitalOcean: config.getBoolean("use-digital-ocean") || false,
    digitalOceanRegion: config.get("do-region") || "nyc3",
})
