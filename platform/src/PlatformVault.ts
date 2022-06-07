import * as docker from "@pulumi/docker"
import * as postgresql from "@pulumi/postgresql"
import * as pulumi from "@pulumi/pulumi"
import * as vault from "@pulumi/vault"



export type PlatformVaultArgs = {
    environment: string
    vaultProvider: vault.Provider

    redis: {
        url: string | pulumi.Output<string>,
        password: pulumi.Output<string>
    },
    rabbitmq: {
        url: string | pulumi.Output<string>,
        management: string | pulumi.Output<string>
    },
    postgres: {
        url: string | pulumi.Output<string>,
        port: string | pulumi.Output<string>,
        database: string | pulumi.Output<string>
    },
    postgresDataScience: {
        url: string | pulumi.Output<string>,
        port: string | pulumi.Output<string>,
        database: string | pulumi.Output<string>
    }
    minio: {
        url: string | pulumi.Output<string>,
        accessKey: string | pulumi.Output<string>,
        secretKey: string | pulumi.Output<string>,
        bucket: string | pulumi.Output<string>,
        imageGenerationBucket: string | pulumi.Output<string>,
        replayBucket: string | pulumi.Output<string>,
    }
}

export class PlatformVault extends pulumi.ComponentResource {
    readonly redisSecret: vault.generic.Secret
    readonly rabbitmqSecret: vault.generic.Secret
    readonly postgresSecret: vault.generic.Secret
    readonly postgresDataScienceSecret: vault.generic.Secret

    readonly minioSecret: vault.generic.Secret


    constructor(name: string, args: PlatformVaultArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Platform:VaultSync", name, {}, opts)

        this.redisSecret = new vault.generic.Secret(`${name}-redis-vault`, {
            path: `platform/${args.environment}/redis`,
            dataJson: pulumi.output(args.redis).apply(r => JSON.stringify(r))
        }, { parent: this, provider: args.vaultProvider })

        this.rabbitmqSecret = new vault.generic.Secret(`${name}-rabbitmq-vault`, {
            path: `platform/${args.environment}/rabbitmq`,
            dataJson: pulumi.output(args.rabbitmq).apply(r => JSON.stringify(r))
        }, { parent: this, provider: args.vaultProvider })

        this.postgresSecret = new vault.generic.Secret(`${name}-postgres-vault`, {
            path: `platform/${args.environment}/postgres`,
            dataJson: pulumi.output(args.postgres).apply(r => JSON.stringify(r))
        }, { parent: this, provider: args.vaultProvider })

        this.postgresDataScienceSecret  = new vault.generic.Secret(`${name}-postgres-data-science-vault`, {
            path: `platform/data-science/${args.environment}/postgres`,
            dataJson: pulumi.output(args.postgresDataScience).apply(r => JSON.stringify(r))
        }, { parent: this, provider: args.vaultProvider })

        this.minioSecret = new vault.generic.Secret(`${name}-minio-vault`, {
            path: `platform/${args.environment}/minio`,
            dataJson: pulumi.output(args.minio).apply(r => JSON.stringify(r))
        }, { parent: this, provider: args.vaultProvider })

    }
}
