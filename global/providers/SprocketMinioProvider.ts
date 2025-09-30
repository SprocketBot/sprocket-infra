import * as vault from "@pulumi/vault";
import { VaultCredentials } from "../helpers/vault/VaultCredentials";
import * as minio from "@pulumi/minio";
import * as pulumi from "@pulumi/pulumi";
import { HOSTNAME } from "../constants";

export interface SprocketMinioProviderArgs extends Omit<minio.ProviderArgs, "minioAccessKey" | "minioSecretKey" | "minioServer" | "minioInsecure"> {
    vaultProvider?: vault.Provider,
    minioCredentials?: VaultCredentials,
    minioHostname: pulumi.Output<string> | string,
    useSsl?: boolean,
    accessKey?: pulumi.Output<string> | string,
    secretKey?: pulumi.Output<string> | string
}

export class SprocketMinioProvider extends minio.Provider {
    constructor({ vaultProvider, minioCredentials, minioHostname, useSsl = true, accessKey, secretKey, ...args }: SprocketMinioProviderArgs, opts?: pulumi.ResourceOptions) {
        let username, password;

        if (accessKey && secretKey) {
            // Use provided credentials directly
            username = accessKey;
            password = secretKey;
        } else if (minioCredentials) {
            username = minioCredentials.username;
            password = minioCredentials.password;
        } else if (vaultProvider) {
            const secret = vault.generic.getSecretOutput({
                path: "infrastructure/data/minio/root"
            }, {
                provider: vaultProvider
            })
            username = secret.data.apply(d => { if (d && d.username) { return d.username } else { return "none"; } })
            password = secret.data.apply(d => { if (d && d.password) { return d.password } else { return "none"; } })
        } else {
            throw new Error("Must provide either accessKey/secretKey, minioCredentials, or vaultProvider");
        }

        super("SprocketMinioProvider", {
            ...args,
            minioAccessKey: username,
            minioSecretKey: password,
            minioServer: minioHostname,
            minioSsl: useSsl
        }, opts);
    }
}
