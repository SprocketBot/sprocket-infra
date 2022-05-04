import * as pulumi from "@pulumi/pulumi"
import * as minio from "@pulumi/minio"
import * as handlebars from "handlebars";
import {readFileSync} from "fs";


export interface PlatformMinioArgs {
    minioProvider: minio.Provider
    environment: string
}

export class PlatformMinio extends pulumi.ComponentResource {
    readonly bucket: minio.S3Bucket
    readonly minioUser: minio.IamUser
    readonly policy: minio.IamPolicy
    readonly minioUrl: string | pulumi.Output<string>

    constructor(name: string, args: PlatformMinioArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Platform:Minio", name, {}, opts)


        this.bucket = new minio.S3Bucket(`${name}-bucket`, {
            bucket: `sprocket-${args.environment}`
        }, { parent: this, provider: args.minioProvider })

        this.minioUser = new minio.IamUser(`${name}-s3-user`, {
            name: `sprocket-${args.environment}`
        }, { parent: this, provider: args.minioProvider })

        const userPolicyContent = readFileSync(`${__dirname}/config/minio/UserPolicy.json`).toString()
        console.log(typeof userPolicyContent)
        const userPolicyTemplate = handlebars.compile(userPolicyContent.toString(), { })
        console.log(userPolicyContent)


        this.policy = new minio.IamPolicy(`${name}-s3-policy`, {
            policy: this.bucket.bucket.apply(b => userPolicyTemplate({ bucket: b }))
        }, { parent: this, provider: args.minioProvider})

        new minio.IamUserPolicyAttachment(`${name}-s3-policy-application`, {
            policyName: this.policy.name, userName: this.minioUser.name
        }, { parent: this, provider: args.minioProvider})


        this.minioUrl = args.minioProvider.minioServer

    }
}