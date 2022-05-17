// Handles self
import {Chatwoot, Minio, Postgres, Redis, VaultPolicies} from "global/services";
import {Monitoring} from "./monitoring";
import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";
import * as postgres from "@pulumi/postgresql"
import * as docker from "@pulumi/docker"
import {LayerOne, LayerOneExports} from "global/refs"

import {SprocketPostgresProvider} from "global/providers/SprocketPostgresProvider"
import {SprocketMinioProvider} from "global/providers/SprocketMinioProvider"

const config = new pulumi.Config()

const ingressNetworkId = LayerOne.stack.requireOutput(LayerOneExports.IngressNetwork) as pulumi.Output<string>;
export const policies = new VaultPolicies("policies", {})

const vaultProvider = new vault.Provider("VaultProvider", {
    address: LayerOne.stack.requireOutput(LayerOneExports.VaultAddress),
    token: policies.infraToken.clientToken
})

export const pg = new Postgres("postgres", {ingressNetworkId, vaultProvider})

export const minio = new Minio("minio", {ingressNetworkId, vaultProvider})

const chatwootNetwork = new docker.Network("chatwoot-network", {
    driver: "overlay"
})

const postgresProvider = new SprocketPostgresProvider({
    vaultProvider: vaultProvider,
    postgresCredentials: pg.credentials,
    postgresHostname: pg.url
}, {}) as postgres.Provider

export const monitoring = new Monitoring("monitoring", {
    postgres: pg,
    exposeInfluxUi: true,
    ingressNetworkId,

    providers: {
        vault: vaultProvider,
        postgres: postgresProvider
    }
}, {dependsOn: [pg]})

const sharedRedis = new Redis("layer2redis", {
    configFilepath: `${__dirname}/config/redis.conf`,
    ingressNetworkId: ingressNetworkId,
    vaultProvider: vaultProvider,
    platformNetworkId: chatwootNetwork.id
})

export const chatwoot = new Chatwoot("chatwoot", {
    ingressNetworkId: ingressNetworkId,
    networkId: chatwootNetwork.id,
    postgresNetworkId: pg.networkId,
    smtp: {
        domain: "sprocket.gg",
        host: "smtp.sendgrid.net",
        password: config.requireSecret("smtp-password"),
        port: 587,
        username: "apikey"
    },
    providers: {
        vault: vaultProvider,
        postgres: postgresProvider,
        minio: new SprocketMinioProvider({minioHostname: minio.url, vaultProvider: vaultProvider})
    },
    postgres: {
        host: pg.hostname,
    },
    redis: {
        host: sharedRedis.hostname,
        password: sharedRedis.credentials.password
    }
})
