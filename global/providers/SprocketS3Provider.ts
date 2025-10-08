import * as vault from "@pulumi/vault";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export interface SprocketS3ProviderArgs {
    vaultProvider?: vault.Provider,
    s3Endpoint: pulumi.Output<string> | string,
    region?: string,
    accessKey?: pulumi.Output<string> | string,
    secretKey?: pulumi.Output<string> | string
}

export class SprocketS3Provider extends aws.Provider {
    constructor({ vaultProvider, s3Endpoint, region = "us-east-1", accessKey, secretKey }: SprocketS3ProviderArgs, opts?: pulumi.ResourceOptions) {
        let accessKeyId, secretAccessKey;

        if (accessKey && secretKey) {
            // Use provided credentials directly
            accessKeyId = accessKey;
            secretAccessKey = secretKey;
        } else if (vaultProvider) {
            const secret = vault.generic.getSecretOutput({
                path: "infrastructure/data/minio/root"
            }, {
                provider: vaultProvider
            })
            accessKeyId = secret.data.apply(d => { if (d && d.username) { return d.username } else { return "none"; } })
            secretAccessKey = secret.data.apply(d => { if (d && d.password) { return d.password } else { return "none"; } })
        } else {
            throw new Error("Must provide either accessKey/secretKey or vaultProvider");
        }

        super("SprocketS3Provider", {
            accessKey: accessKeyId,
            secretKey: secretAccessKey,
            region: region,
            skipCredentialsValidation: true,
            skipMetadataApiCheck: true,
            skipRequestingAccountId: true,
            endpoints: [{
                s3: pulumi.output(s3Endpoint).apply(endpoint => `https://${endpoint}`)
            }],
            s3UsePathStyle: false
        }, opts);
    }
}
