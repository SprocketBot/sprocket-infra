import * as docker from "@pulumi/docker"
import * as postgresql from "@pulumi/postgresql"
import * as pulumi from "@pulumi/pulumi"
import * as vault from "@pulumi/vault"
import * as minio from "@pulumi/minio"
import * as random from "@pulumi/random";

import {SprocketService, SprocketServiceArgs} from "./microservices/SprocketService";
import {PlatformDatastore} from "./PlatformDatastore";

import {TraefikLabels} from "global/helpers/docker/TraefikLabels";
import {buildHost} from "global/helpers/buildHost";
import {HOSTNAME} from "global/constants"
import {PlatformSecrets} from "./PlatformSecrets";
import {PlatformDatabase} from "./PlatformDatabase";
import {PlatformVault} from "./PlatformVault";
import {PlatformMinio} from "./PlatformMinio";
import {EloService} from "./microservices/EloService";
import { LegacyPlatform } from './legacy/LegacyPlatform';

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
        web: SprocketService,
        imageGen: SprocketService
    }


    readonly apiUrl: string
    readonly webUrl: string
    readonly igUrl: string

    readonly key: random.RandomUuid

    readonly vaultSync: PlatformVault

    readonly services: {
        imageGen: SprocketService,
        analytics: SprocketService,
        matchmaking: SprocketService,
        replayParse: SprocketService,
        elo: EloService,
        notifications: SprocketService,
        submissions: SprocketService
    }

    constructor(name: string, args: PlatformArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Platform", name, {}, opts)

        this.key = new random.RandomUuid(`${name}-key`)

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
            minioUser: this.objectStorage.minioUser,
            vault: args.vault.platform,
            environment: this.environmentSubdomain
        }, {parent: this})


        /////////////////
        // Create Clients / Core
        /////////////////
        this.apiUrl = buildHost("api", this.environmentSubdomain, HOSTNAME)
        this.webUrl = buildHost(this.environmentSubdomain, HOSTNAME)
        this.igUrl = buildHost("image-generation", this.environmentSubdomain, HOSTNAME)

        const coreLabels = new TraefikLabels("sprocket-core")
            .tls("lets-encrypt-tls")
            .rule(`Host(\`${this.apiUrl}\`)`)
            .targetPort(3001)
        const webLabels = new TraefikLabels("sprocket-web")
            .tls("lets-encrypt-tls")
            .rule(`Host(\`${this.webUrl}\`)`)
            .targetPort(3000)
        const imageGenLabels = new TraefikLabels("sprocket-image-gen")
          .tls("lets-encrypt-tls")
          .rule(`Host(\`${this.igUrl}\`)`)
          .targetPort(3000)

        if (config.getBoolean("alpha-restrictions")) {
            webLabels.forwardAuthRule("AlphaTesters")
        }

        this.core = new SprocketService(`${name}-sprocket-core`, {
            ...this.buildDefaultConfiguration("core", args.configRoot),
            labels: [
                ...coreLabels.complete
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
            }, {
                secretId: this.secrets.discordClientSecret.id,
                secretName: this.secrets.discordClientSecret.name,
                fileName: "/app/secret/discord-secret.txt"
            }, {
                secretId: this.secrets.discordClientId.id,
                secretName: this.secrets.discordClientId.name,
                fileName: "/app/secret/discord-client.txt"
            }, {
                secretId: this.secrets.redisPassword.id,
                secretName: this.secrets.redisPassword.name,
                fileName: "/app/secret/redis-password.txt"
            }],
            networks: [
                args.ingressNetworkId
            ]
        }, {parent: this})

        this.clients = {
            web: new SprocketService(`${name}-sprocket-web`, {
                ...this.buildDefaultConfiguration("web", args.configRoot),
                labels: [
                    ...webLabels.complete
                ],
                configFile: {
                    destFilePath: "/app/src/config.json",
                    sourceFilePath: `${args.configRoot}/web.json`,
                },
                networks: [
                    args.ingressNetworkId
                ],
            }, {parent: this}),

            imageGen: new SprocketService(`${name}-sprocket-image-generation-frontend`, {
                ...this.buildDefaultConfiguration("image-generation-frontend", args.configRoot),
                labels: [
                    ...imageGenLabels.complete
                ],
                configFile: {
                    destFilePath: "/app/src/config.json",
                    sourceFilePath: `${args.configRoot}/image-generation-frontend.json`,
                },
                networks: [
                    args.ingressNetworkId
                ],
            }),

            discordBot: new SprocketService(`${name}-discord-bot`, {
                ...this.buildDefaultConfiguration("discord-bot", args.configRoot),
                secrets: [{
                    secretId: this.secrets.discordBotToken.id,
                    secretName: this.secrets.discordBotToken.name,
                    fileName: "/app/secret/bot-token.txt"
                }, {
                    secretId: this.secrets.s3SecretKey.id,
                    secretName: this.secrets.s3SecretKey.name,
                    fileName: "/app/secret/minio-secret.txt"
                }, {
                    secretId: this.secrets.s3AccessKey.id,
                    secretName: this.secrets.s3AccessKey.name,
                    fileName: "/app/secret/minio-access.txt"
                }]
            }, {parent: this})
        }


        /////////////////
        // Create Microservices
        /////////////////

        this.services = {
            notifications: new SprocketService(`${name}-notification-service`, {
                ...this.buildDefaultConfiguration("notification-service", args.configRoot),
            }, { parent: this }),
            // TODO: Set up Minio for internal storage
            imageGen: new SprocketService(`${name}-image-generation-service`, {
                ...this.buildDefaultConfiguration("image-generation-service", args.configRoot),
                secrets: [{
                    secretId: this.secrets.s3SecretKey.id,
                    secretName: this.secrets.s3SecretKey.name,
                    fileName: "/app/secret/minio-secret.txt"
                },{
                    secretId: this.secrets.s3AccessKey.id,
                    secretName: this.secrets.s3AccessKey.name,
                    fileName: "/app/secret/minio-access.txt"
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
                }]
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
                env: {
                    ENV: "production"
                },
                secrets: [{
                    secretId: this.secrets.s3SecretKey.id,
                    secretName: this.secrets.s3SecretKey.name,
                    fileName: "/app/secret/s3-secret"
                }, {
                    secretId: this.secrets.ballchasingApiToken.id,
                    secretName: this.secrets.ballchasingApiToken.name,
                    fileName: "/app/secret/ballchasing-token"
                }]
            }, {parent: this}),

            elo: new EloService(`${name}-elo-service`, {
                vault: args.vault.platform,
                ...this.buildDefaultConfiguration("elo-service", args.configRoot),
                env: {
                    ENV: "production"
                },
                ingressNetworkId: args.ingressNetworkId
            }, {parent: this}),

            submissions: new SprocketService(`${name}-submission-service`, {
                ...this.buildDefaultConfiguration("submission-service", args.configRoot),
                env: {
                    ENV: "production"
                },
                secrets: [{
                    secretId: this.secrets.s3SecretKey.id,
                    secretName: this.secrets.s3SecretKey.name,
                    fileName: "/app/secret/minio-secret.txt"
                }, {
                    secretId: this.secrets.s3AccessKey.id,
                    secretName: this.secrets.s3AccessKey.name,
                    fileName: "/app/secret/minio-access.txt"
                }, {
                    secretId: this.secrets.redisPassword.id,
                    secretName: this.secrets.redisPassword.name,
                    fileName: "/app/secret/redis-password.txt"
                }]
            })
        };

        this.vaultSync = new PlatformVault(`${name}-vault-sync`, {
            vaultProvider: args.vault.platform,
            environment: this.environmentSubdomain,
            redis: {
                url: this.datastore.redis.url ?? "",
                password: this.datastore.redis.credentials.password
            },
            rabbitmq: {
                url: this.datastore.rabbitmq.url,
                management: this.datastore.rabbitmq.managementUrl
            },
            postgres: {
                url: HOSTNAME,
                port: "30000",
                database: this.database.database.name
            },
            postgresDataScience: {
                url: HOSTNAME,
                port: "30000",
                database: this.database.database.name
            },
            minio: {
                url: this.objectStorage.minioUrl,
                accessKey: this.objectStorage.minioUser.name,
                secretKey: this.objectStorage.minioUser.secret,
                bucket: this.objectStorage.bucket.bucket,
                imageGenerationBucket: this.objectStorage.imageGenBucket.bucket,
                replayBucket: this.objectStorage.replayBucket.bucket
            }
        })

        // Only include on dev.
        if (pulumi.getStack() !== 'dev') return;
        new LegacyPlatform(`${name}-legacy`, {
            database: this.database,
            minio: this.objectStorage,
            postgresNetworkId: this.postgresNetworkId,
            postgresProvider: args.postgresProvider,
            vaultProvider: args.vault.infrastructure
        }, { parent: this })
    }

    buildDefaultConfiguration = (name: string, configRoot: string): SprocketServiceArgs => ({
        image: {namespace: "actualsovietshark", repository: name, tag: config.require("image-tag")},
        platformNetworkId: this.network.id,
        configFile: {sourceFilePath: `${configRoot}/${name}.json`},
        configValues: {
            transport: pulumi.all([this.datastore.rabbitmq.hostname, this.key.result]).apply(([rmqHost, key]) => JSON.stringify({
                url: `amqp://${rmqHost}:5672`,
                matchmaking_queue: `${pulumi.getStack()}-matchmaking`,
                core_queue: `${pulumi.getStack()}-core`,
                bot_queue: `${pulumi.getStack()}-bot`,
                analytics_queue: `${pulumi.getStack()}-analytics`,
                events_queue: `${pulumi.getStack()}-events`,
                events_application_key: `${pulumi.getStack()}-${name}-${key}`,
                "celery-queue": `${pulumi.getStack()}-celery`,
                image_generation_queue: `${pulumi.getStack()}-ig`,
                submission_queue: `${pulumi.getStack()}-submissions`,
                notification_queue: `${pulumi.getStack()}-notifications`
            }, null, 2)),
            logger: {
                levels: pulumi.getStack() === "main" ? JSON.stringify(["error", "warn", "log"]) : JSON.stringify(["error", "warn", "log", "debug"])
            },
            database: {
                host: this.database.host,
                port: 5432,
                passwordSecret: this.secrets.postgresPassword,
                username: this.database.credentials.username,
                database: this.database.database.name,
                networkId: this.postgresNetworkId
            },
            redis: {
                port: 6379,
                host: this.datastore.redis.hostname,
                prefix: this.environmentSubdomain,
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
                bucket: this.objectStorage.bucket.bucket,
                buckets: {
                    imageGeneration: this.objectStorage.imageGenBucket.bucket,
                    replayParse: this.objectStorage.replayBucket.bucket
                }
            },
            celery: {
                broker: this.datastore.rabbitmq?.hostname.apply(h => `amqp://${h}`) ?? "",
                backend: pulumi.all([this.datastore.redis?.hostname, this.datastore.redis?.credentials.password]).apply(([h,p]) => `redis://:${p}@${h}`) ?? "",
                queue: `${this.environmentSubdomain}-celery`
            },
            bot: {
                prefix: this.environmentSubdomain === "main" ? "s." : `${this.environmentSubdomain}.`
            },
            gql: {
                internal: this.core?.hostname ? this.core.hostname.apply(h => `${h}:3001/graphql`) : "",
                public: this.apiUrl
            },
            frontend: {
                url: this.webUrl
            },
            api: {
                url: this.apiUrl
            }
        }
    })
}
