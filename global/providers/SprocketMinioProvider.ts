import * as doppler from "@pulumi/doppler";

import * as minio from "@pulumi/minio";
import * as pulumi from "@pulumi/pulumi";
import {HOSTNAME} from "../constants";

export interface SprocketMinioProviderArgs extends Omit<minio.ProviderArgs, "minioAccessKey" | "minioSecretKey" | "minioServer" | "minioInsecure"> {
    dopplerProvider: doppler.Provider,
    minioHostname: pulumi.Output<string> | string
}

export class SprocketMinioProvider extends minio.Provider {
    constructor({dopplerProvider, minioHostname, ...args}: SprocketMinioProviderArgs, opts?: pulumi.ResourceOptions) {
        const accessKey = new doppler.Secret("minio-access-key", {
            project: "sprocket", // Assuming "sprocket" is your Doppler project name
            config: "infrastructure", // Assuming "infrastructure" is your Doppler config for infrastructure secrets
            name: "MINIO_ACCESS_KEY"
        }, { provider: dopplerProvider }).value;

        const secretKey = new doppler.Secret("minio-secret-key", {
            project: "sprocket",
            config: "infrastructure",
            name: "MINIO_SECRET_KEY"
        }, { provider: dopplerProvider }).value;

        super("SprocketMinioProvider", {
            ...args,
            minioAccessKey: username,
            minioSecretKey: password,
            minioServer: minioHostname,
            minioSsl: true
        }, opts);
    }
}
