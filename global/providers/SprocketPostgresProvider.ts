import * as pulumi from "@pulumi/pulumi"
import * as postgres from "@pulumi/postgresql";
import * as vault from "@pulumi/vault";
import {HOSTNAME} from "../constants";
import {VaultCredentials} from "../helpers/vault/VaultCredentials";

export interface SprocketPostgresProviderArgs extends Omit<postgres.ProviderArgs, "username" | "password" | "host" | "sslmode" | "port"> {
    vaultProvider: vault.Provider,
    postgresCredentials?: VaultCredentials
}

export class SprocketPostgresProvider extends postgres.Provider {
    constructor({vaultProvider, postgresCredentials, ...args}: SprocketPostgresProviderArgs, opts?: pulumi.ResourceOptions) {
        let username, password;
        if (postgresCredentials) {
            username = postgresCredentials.username;
            password = postgresCredentials.password;
        } else {
            const secret = vault.generic.getSecretOutput({
                path: "infrastructure/postgres/root"
            }, {
                provider: vaultProvider
            })
            username = secret.data.apply(d => d.username)
            password = secret.data.apply(d => d.password)
        }

        super("SprocketPostgresProvider", {
            ...args,
            username,
            password,
            host: HOSTNAME,
            sslmode: 'disable',
            port: 30000
        }, opts);
    }
}