import * as docker from "@pulumi/docker"
import * as pulumi from "@pulumi/pulumi"
import * as random from "@pulumi/random"

import {LayerTwo, LayerTwoExports} from "global/refs"
import {PlatformDatastore} from "./PlatformDatastore";
import {PlatformDatabase} from "./PlatformDatabase";


const config = new pulumi.Config()

export interface PlatformSecretsArgs {
    datastore: PlatformDatastore,
    database: PlatformDatabase
}


export class PlatformSecrets extends pulumi.ComponentResource {
    readonly influxToken: docker.Secret
    readonly discordBotToken: docker.Secret

    readonly s3SecretKey: docker.Secret
    readonly s3AccessKey: docker.Secret


    readonly redisPassword: docker.Secret
    readonly postgresPassword: docker.Secret

    readonly jwtSecret: docker.Secret

    constructor(name: string, args: PlatformSecretsArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Platform:Secrets", name, {}, opts)


        this.influxToken = new docker.Secret(`${name}-influx-token`, {
            data: LayerTwo.stack.requireOutput(LayerTwoExports.InfluxDbToken)
        })

        this.s3SecretKey = new docker.Secret(`${name}-s3-secret`, {
            data: config.requireSecret("s3-secret-key")
        })
        this.s3SecretKey = new docker.Secret(`${name}-s3-secret`, {
            data: config.require("s3-access-key")
        })

        this.redisPassword = new docker.Secret(`${name}-redis-password`, {
            data: args.datastore.redis.credentials.password
        })

        this.discordBotToken = new docker.Secret(`${name}-discord-token`, {
            data: config.requireSecret("discord-bot-token")
        })

        this.postgresPassword = new docker.Secret(`${name}-db-password`, {
            data: args.database.credentials.password
        })

        this.jwtSecret = new docker.Secret(`${name}-jwt-secret`, {
            data: new random.RandomPassword(`${name}-jwt-secret-randomizer`, {
                length: 128
            }).result
        })
    }
}