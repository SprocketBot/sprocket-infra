import * as pulumi from "@pulumi/pulumi"
import * as aws from "@pulumi/aws"
import * as vault from "@pulumi/vault"

export interface PlatformS3Args {
    s3Provider: aws.Provider
    s3Endpoint: pulumi.Output<string> | string
    vaultProvider: vault.Provider
    environment: string
}

export class PlatformS3 extends pulumi.ComponentResource {
    readonly bucket: aws.s3.Bucket
    readonly imageGenBucket: aws.s3.Bucket
    readonly replayBucket: aws.s3.Bucket

    readonly s3AccessKey: { id: pulumi.Output<string>, secret: pulumi.Output<string> }

    readonly s3Url: string | pulumi.Output<string>

    constructor(name: string, args: PlatformS3Args, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Platform:S3", name, {}, opts)

        // Create buckets (S3 API is supported by DO Spaces)
        this.bucket = new aws.s3.Bucket(`${name}-bucket`, {
            bucket: `sprocket-${args.environment}-1`,
            acl: "private"
        }, { parent: this, provider: args.s3Provider })

        this.imageGenBucket = new aws.s3.Bucket(`${name}-ig-bucket`, {
            bucket: `sprocket-image-gen-${args.environment}-1`,
            acl: "private"
        }, { parent: this, provider: args.s3Provider })

        this.replayBucket = new aws.s3.Bucket(`${name}-replay-bucket`, {
            bucket: `sprocket-replays-${args.environment}-1`,
            acl: "private"
        }, { parent: this, provider: args.s3Provider })

        // DigitalOcean Spaces doesn't support IAM user creation via API
        // Instead, we retrieve the credentials from Vault that were manually created in DO console
        const s3Credentials = vault.generic.getSecretOutput({
            path: "infrastructure/data/minio/root"
        }, {
            provider: args.vaultProvider
        })

        // Use the root credentials for S3 access
        this.s3AccessKey = {
            id: s3Credentials.data.apply(d => d.username as string),
            secret: s3Credentials.data.apply(d => d.password as string)
        }

        // Use the provided endpoint
        this.s3Url = args.s3Endpoint
    }
}
