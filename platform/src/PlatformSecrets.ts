import * as docker from "@pulumi/docker"
import * as pulumi from "@pulumi/pulumi"
import * as random from "@pulumi/random"
import * as minio from "@pulumi/minio"

import {LayerTwo, LayerTwoExports} from "global/refs"
import {PlatformDatastore} from "./PlatformDatastore";
import {PlatformDatabase} from "./PlatformDatabase";


const config = new pulumi.Config()

export interface PlatformSecretsArgs {
    datastore: PlatformDatastore,
    database: PlatformDatabase,
    minioUser: minio.IamUser
}


export class PlatformSecrets extends pulumi.ComponentResource {
    readonly influxToken: docker.Secret
    readonly discordBotToken: docker.Secret

    readonly s3SecretKey: docker.Secret
    readonly s3AccessKey: docker.Secret


    readonly redisPassword: docker.Secret
    readonly postgresPassword: docker.Secret

    readonly jwtSecret: docker.Secret

    readonly googleClientId: docker.Secret
    readonly googleClientSecret: docker.Secret

    constructor(name: string, args: PlatformSecretsArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Platform:Secrets", name, {}, opts)


        this.influxToken = new docker.Secret(`${name}-influx-token`, {
            data: LayerTwo.stack.requireOutput(LayerTwoExports.InfluxDbToken).apply(btoa)
        }, { parent: this })

        this.s3SecretKey = new docker.Secret(`${name}-s3-secret`, {
            data: args.minioUser.secret.apply(btoa)
        }, { parent: this })

        this.s3AccessKey = new docker.Secret(`${name}-s3-access`, {
            data: args.minioUser.name.apply(btoa)
        }, { parent: this })

        this.redisPassword = new docker.Secret(`${name}-redis-password`, {
            data: args.datastore.redis.credentials.password.apply(btoa)
        }, { parent: this })

        this.discordBotToken = new docker.Secret(`${name}-discord-token`, {
            data: config.requireSecret("discord-bot-token").apply(btoa)
        }, { parent: this })

        this.postgresPassword = new docker.Secret(`${name}-db-password`, {
            data: args.database.credentials.password.apply(btoa)
        }, { parent: this })

        this.jwtSecret = new docker.Secret(`${name}-jwt-secret`, {
            data: new random.RandomPassword(`${name}-jwt-secret-randomizer`, {
                length: 128
            }).result.apply(btoa)
        }, { parent: this })

        this.googleClientId = new docker.Secret(`${name}-google-client-id`, {
            data: btoa("blah")
        }, { parent: this })

        this.googleClientSecret = new docker.Secret(`${name}-google-secret`, {
            data: btoa("blah")
        }, { parent: this })
    }
}