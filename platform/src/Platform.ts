import * as docker from "@pulumi/docker"
import * as postgresql from "@pulumi/postgresql"
import * as pulumi from "@pulumi/pulumi"
import * as vault from "@pulumi/vault"
import * as minio from "@pulumi/minio"

import {SprocketService, SprocketServiceArgs} from "./microservices/SprocketService";
import {PlatformDatastore} from "./PlatformDatastore";

import {TraefikLabels} from "global/helpers/docker/TraefikLabels";
import {buildHost} from "global/helpers/buildHost";
import {HOSTNAME} from "global/constants"
import {PlatformSecrets} from "./PlatformSecrets";
import {PlatformDatabase} from "./PlatformDatabase";
import {PlatformVault} from "./PlatformVault";
import {PlatformMinio} from "./PlatformMinio";

const config = new pulumi.Config()

export interface PlatformArgs {
    vault: {
        infrastructure: vault.Provider,
        platform: vault.Provider
    }

    postgresProvider: postgresql.Provider
    postgresHostname: string | pulumi.Output<string>

    minioProvider: minio.Provider

    ingressNetworkId: docker.Network["id"],
    monitoringNetworkId: docker.Network["id"],
    postgresNetworkId: docker.Network["id"],

    configRoot: string
}

export class Platform extends pulumi.ComponentResource {
    readonly environmentSubdomain: string
    readonly postgresNetworkId: string | pulumi.Output<string>

    readonly datastore: PlatformDatastore
    readonly network: docker.Network

    readonly secrets: PlatformSecrets
    readonly database: PlatformDatabase
    readonly objectStorage: PlatformMinio

    readonly core: SprocketService
    readonly clients: {
        discordBot: SprocketService,
        web: SprocketService
    }


    readonly apiUrl: string
    readonly webUrl: string

    readonly vaultSync: PlatformVault

    readonly services: {
        imageGen: SprocketService,
        analytics: SprocketService,
        matchmaking: SprocketService,
        replayParse: SprocketService
    }

    constructor(name: string, args: PlatformArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Platform", name, {}, opts)

        this.environmentSubdomain = config.require("subdomain")
        this.postgresNetworkId = args.postgresNetworkId
        this.network = new docker.Network(`${name}-net`, {driver: "overlay"}, {parent: this})


        this.objectStorage = new PlatformMinio(`${name}-minio`, {
            environment: this.environmentSubdomain,
            minioProvider: args.minioProvider
        })

        this.datastore = new PlatformDatastore(`${name}-datastores`, {
            environmentSubdomain: this.environmentSubdomain,
            ingressNetworkId: args.ingressNetworkId,
            vaultProvider: args.vault.infrastructure,
            platformNetworkId: this.network.id,
            configRoot: `${args.configRoot}/datastores`
        }, {parent: this})

        this.database = new PlatformDatabase(`${name}-database`, {
            environmentSubdomain: this.environmentSubdomain,
            postgresHostname: args.postgresHostname,
            postgresProvider: args.postgresProvider,
            vaultProvider: args.vault.infrastructure
        }, {parent: this})

        this.secrets = new PlatformSecrets(`${name}-secrets`, {
            datastore: this.datastore,
            database: this.database,
            minioUser: this.objectStorage.minioUser
        }, {parent: this})


        /////////////////
        // Create Clients / Core
        /////////////////

        this.apiUrl = buildHost("api", this.environmentSubdomain, HOSTNAME)
        this.webUrl = buildHost(this.environmentSubdomain, HOSTNAME)
        this.core = new SprocketService(`${name}-sprocket-core`, {
            ...this.buildDefaultConfiguration("sprocket-core", args.configRoot),
            image: {
                namespace: "actualsovietshark", repository: "sprocket-core", tag: "main"
            },
            labels: [
                ...new TraefikLabels("sprocket-core")
                    .tls("lets-encrypt-tls")
                    .rule(`Host(\`${this.apiUrl}\`)`)
                    .targetPort(3001)
                    .complete
            ],
            flags: {database: true},
            secrets: [{
                secretId: this.secrets.jwtSecret.id,
                secretName: this.secrets.jwtSecret.name,
                fileName: "/app/secret/jwtSecret.txt"
            }, {
                secretId: this.secrets.s3SecretKey.id,
                secretName: this.secrets.s3SecretKey.name,
                fileName: "/app/secret/minio-secret.txt"
            }, {
                secretId: this.secrets.s3AccessKey.id,
                secretName: this.secrets.s3AccessKey.name,
                fileName: "/app/secret/minio-access.txt"
            }, {
                secretId: this.secrets.googleClientId.id,
                secretName: this.secrets.googleClientId.name,
                fileName: "/app/secret/googleClientId.txt"
            }, {
                secretId: this.secrets.googleClientSecret.id,
                secretName: this.secrets.googleClientSecret.name,
                fileName: "/app/secret/googleSecret.txt"
            }]
        }, {parent: this})

        this.clients = {
            web: new SprocketService(`${name}-sprocket-web`, {
                ...this.buildDefaultConfiguration("sprocket-web", args.configRoot),
                labels: [
                    ...new TraefikLabels("sprocket-web")
                        .tls("lets-encrypt-tls")
                        .rule(`Host(\`${this.webUrl}\`)`)
                        .targetPort(3000)
                        .complete
                ],
                configFile: {
                    destFilePath: "/app/src/config.json",
                    sourceFilePath: `${args.configRoot}/sprocket-web.json`,
                },
                networks: [
                    args.ingressNetworkId
                ],
                image: {
                    namespace: "actualsovietshark", repository: "sprocket-web", tag: "main"
                }
            }, {parent: this}),

            discordBot: new SprocketService(`${name}-discord-bot`, {
                ...this.buildDefaultConfiguration("discord-bot", args.configRoot),
                image: {
                    namespace: "actualsovietshark", repository: "discord-bot", tag: "main"
                },
                secrets: [{
                    secretId: this.secrets.discordBotToken.id,
                    secretName: this.secrets.discordBotToken.name,
                    fileName: "/app/secret/bot-token.txt"
                }]
            }, {parent: this})
        }


        /////////////////
        // Create Microservices
        /////////////////

        this.services = {
            // TODO: Set up Minio for internal storage
            imageGen: new SprocketService(`${name}-image-generation-service`, {
                ...this.buildDefaultConfiguration("image-generation-service", args.configRoot),
                secrets: [{
                    secretId: this.secrets.s3SecretKey.id,
                    secretName: this.secrets.s3SecretKey.name,
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
                    secretName: this.secrets.influxToken.name,
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
                    secretName: this.secrets.redisPassword.name,
                    fileName: "/app/secret/redis-password.txt"
                }]
            }, {parent: this}),

            replayParse: new SprocketService(`${name}-replay-parse-service`, {
                ...this.buildDefaultConfiguration("replay-parse-service", args.configRoot),
                image: {
                    namespace: "actualsovietshark", repository: "replay-parse-service", tag: "main"
                },
                env: {
                    ENV: "production"
                },
                secrets: [{
                    secretId: this.secrets.s3SecretKey.id,
                    secretName: this.secrets.s3SecretKey.name,
                    fileName: "/app/secret/s3-secret"
                }]
            }, {parent: this})
        };

        this.vaultSync = new PlatformVault(`${name}-vault-sync`, {
            vaultProvider: args.vault.platform,
            environment: this.environmentSubdomain,
            redis: {
                url: this.datastore.redis.url,
                password: this.datastore.redis.credentials.password
            },
            rabbitmq: {
                url: this.datastore.rabbitmq.url,
                management: this.datastore.rabbitmq.managementUrl
            },
            postgres: {
                url: HOSTNAME,
                port: "30000",
                username: this.database.credentials.username,
                password: this.database.credentials.password,
                database: this.database.database.name
            },
            minio: {
                url: this.objectStorage.minioUrl,
                accessKey: this.objectStorage.minioUser.name,
                secretKey: this.objectStorage.minioUser.secret,
                bucket: this.objectStorage.bucket.bucket
            }
        })
    }

    buildDefaultConfiguration = (name: string, configRoot: string): SprocketServiceArgs => ({
        image: {namespace: "actualsovietshark", repository: name, tag: config.require("image-tag")},
        platformNetworkId: this.network.id,
        configFile: {sourceFilePath: `${configRoot}/${name}.json`},
        configValues: {
            database: {
                host: this.database.host,
                port: 5432,
                passwordSecret: this.secrets.postgresPassword,
                username: this.database.credentials.username,
                database: this.database.database.name,
                networkId: this.postgresNetworkId
            },
            redis: {
                host: this.datastore.redis.hostname
            },
            rmq: {
                host: this.datastore.rabbitmq.hostname
            },
            influx: {
                host: "",
                org: "",
                bucket: "",
            },
            s3: {
                endpoint: this.objectStorage.minioUrl,
                port: 443,
                ssl: true,
                accessKey: this.objectStorage.minioUser.name,
                bucket: this.objectStorage.bucket.bucket
            },
            celery: {
                broker: this.datastore.rabbitmq?.hostname.apply(h => `amqp://${h}`) ?? "",
                backend: this.datastore.redis?.hostname.apply(h => `redis://${h}`) ?? "",
                queue: `${this.environmentSubdomain}-celery`
            },
            bot: {
                prefix: this.environmentSubdomain === "main" ? "s." : `${this.environmentSubdomain}.`
            },
            gql: {
                internal: this.core?.hostname ? this.core.hostname.apply(h => `${h}:3001/graphql`) : "",
                public: `${this.apiUrl}/graphql`
            }
        }
    })
}