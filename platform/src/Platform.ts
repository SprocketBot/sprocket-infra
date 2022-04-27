import * as docker from "@pulumi/docker"
import * as postgresql from "@pulumi/postgresql"
import * as pulumi from "@pulumi/pulumi"
import * as vault from "@pulumi/vault"

import {SprocketService, SprocketServiceArgs} from "./microservices/SprocketService";
import {PlatformDatastore} from "./PlatformDatastore";

import {TraefikLabels} from "global/helpers/docker/TraefikLabels";
import {buildHost} from "global/helpers/buildHost";
import {HOSTNAME} from "global/constants"
import {PlatformSecrets} from "./PlatformSecrets";
import {PlatformDatabase} from "./PlatformDatabase";

const config = new pulumi.Config()

export interface PlatformArgs {
    vaultProvider: vault.Provider,
    postgresProvider: postgresql.Provider
    postgresHostname: string | pulumi.Output<string>

    ingressNetworkId: docker.Network["id"],
    monitoringNetworkId: docker.Network["id"],

    configRoot: string
}


export class Platform extends pulumi.ComponentResource {
    readonly environmentSubdomain: string

    readonly datastore: PlatformDatastore
    readonly network: docker.Network

    readonly secrets: PlatformSecrets
    readonly database: PlatformDatabase

    readonly core: SprocketService
    readonly clients: {
        discordBot: SprocketService,
        web: SprocketService
    }

    readonly services: {
        imageGen: SprocketService,
        analytics: SprocketService,
        matchmaking: SprocketService,
        replayParse: SprocketService
    }

    constructor(name: string, args: PlatformArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Platform", name, {}, opts)

        this.environmentSubdomain = config.require("subdomain")

        this.network = new docker.Network(`${name}-net`, {driver: "overlay"}, {parent: this})


        this.datastore = new PlatformDatastore(`${name}-datastores`, {
            environmentSubdomain: this.environmentSubdomain,
            ingressNetworkId: args.ingressNetworkId,
            vaultProvider: args.vaultProvider,
            platformNetworkId: this.network.id,
            configRoot: `${args.configRoot}/datastores`
        }, {parent: this})

        this.database = new PlatformDatabase(`${name}-database`, {
            environmentSubdomain: this.environmentSubdomain,
            postgresHostname: args.postgresHostname,
            postgresProvider: args.postgresProvider,
            vaultProvider: args.vaultProvider
        }, {parent: this})

        this.secrets = new PlatformSecrets(`${name}-secrets`, {
            datastore: this.datastore,
            database: this.database
        }, {parent: this})


        /////////////////
        // Create Microservices
        /////////////////

        this.services = {
            // TODO: Set up Minio for internal storage
            imageGen: new SprocketService(`${name}-image-generation-service`, {
                ...this.buildDefaultConfiguration("image-generation-service", args.configRoot),
                secrets: [{
                    secretId: this.secrets.s3SecretKey.id,
                    fileName: "/app/secret/s3-password.txt"
                }]
            }, {parent: this}),

            analytics: new SprocketService(`${name}-server-analytics-service`, {
                ...this.buildDefaultConfiguration("server-analytics-service", args.configRoot),
                networks: [
                    args.monitoringNetworkId
                ],
                secrets: [{
                    secretId: this.secrets.influxToken.id,
                    fileName: "/app/secret/influx-token"
                }],
                image: {
                    namespace: "actualsovietshark", repository: "server-analytics-service", tag: "main"
                }
            }, {parent: this}),

            matchmaking: new SprocketService(`${name}-matchmaking-service`, {
                ...this.buildDefaultConfiguration("matchmaking-service", args.configRoot),
                secrets: [{
                    secretId: this.secrets.redisPassword.id,
                    fileName: "/app/secret/redis-password.txt"
                }]
            }, {parent: this}),

            replayParse: new SprocketService(`${name}-replay-parse-service`, {
                ...this.buildDefaultConfiguration("replay-parse-service", args.configRoot),
                image: {
                    namespace: "actualsovietshark", repository: "replay-parse-service", tag: "main"
                }
            }, {parent: this})
        };

        /////////////////
        // Create Clients / Core
        /////////////////

        this.core = new SprocketService(`${name}-sprocket-core`, {
            ...this.buildDefaultConfiguration("sprocket-core", args.configRoot),
            image: {
                namespace: "actualsovietshark", repository: "sprocket-core", tag: "main"
            },
            flags: {database: true},
            secrets: [{
                secretId: this.secrets.jwtSecret.id,
                fileName: "/app/secret/jwtSecret.txt"
            }, {
                secretId: this.secrets.s3SecretKey.id,
                fileName: "/app/secret/minio-secret.txt"
            }, {
                secretId: this.secrets.s3AccessKey.id,
                fileName: "/app/secret/minio-access.txt"
            }]
        }, {parent: this})

        this.clients = {
            web: new SprocketService(`${name}-sprocket-web`, {
                ...this.buildDefaultConfiguration("sprocket-web", args.configRoot),
                labels: [
                    ...new TraefikLabels("sprocket-web")
                        .tls("lets-encrypt-tls")
                        .rule(`Host(\`${buildHost(this.environmentSubdomain), HOSTNAME}\`)`)
                        .complete
                ],
                image: {
                    namespace: "actualsovietshark", repository: "sprocket-web", tag: "main"
                }
            }, {parent: this}),

            discordBot: new SprocketService(`${name}-discord-bot`, {
                ...this.buildDefaultConfiguration("discord-bot", args.configRoot),
                image: {
                    namespace: "actualsovietshark", repository: "discord-bot", tag: "main"
                }
            }, {parent: this})
        }
    }

    buildDefaultConfiguration = (name: string, configRoot: string): SprocketServiceArgs => ({
        image: {namespace: "actualsovietshark", repository: name, tag: config.require("image-tag")},
        platformNetworkId: this.network.id,
        configFile: {sourceFilePath: `${configRoot}/${name}.json`},
        configValues: {
            database: {
                host: this.database.host,
                port: 5432,
                passwordSecretId: this.secrets.postgresPassword.id
            },
            s3: {
                endpoint: "https://nyc3.digitaloceanspaces.com",
                port: 443,
                ssl: true,
                accessKey: "2CUL33XKLZXGIGB5CSSV",
                bucket: "sprocket"
            },
            celery: {
                broker: `amqp://${this.datastore.rabbitmq.hostname}`,
                backend: `redis://${this.datastore.redis.hostname}`,
                queue: `${this.environmentSubdomain}-celery`
            },
            bot: {
                prefix: this.environmentSubdomain === "main" ? "s." : `${this.environmentSubdomain}.`
            },
            gql: {
                host: ""
            }

        }
    })
}