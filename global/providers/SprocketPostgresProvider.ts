import * as pulumi from "@pulumi/pulumi"
import * as postgres from "@pulumi/postgresql";
import * as vault from "@pulumi/vault";

export interface SprocketPostgresProviderArgs extends Omit<postgres.ProviderArgs, "username" | "password" | "host" | "sslmode" | "port"> {
    vaultProvider: vault.Provider
}

const config = new pulumi.Config();

export class SprocketPostgresProvider extends postgres.Provider {
    readonly hostname: string;
    readonly networkId: string;
    readonly url: string;

    constructor({ vaultProvider, ...args }: SprocketPostgresProviderArgs, opts?: pulumi.ResourceOptions) {
        const secret = vault.generic.getSecretOutput({
            path: "infrastructure/data/postgres/root"
        }, {
            provider: vaultProvider
        });

        const username = config.require('postgres-username');
        const password = config.require('postgres-password');
        const host = config.require('postgres-host');
        const port = config.requireNumber('postgres-port');


        // const username = secret.data.apply(d => d.username);
        // const password = secret.data.apply(d => d.password);
        // const host = secret.data.apply(d => d.host);
        // const port = secret.data.apply(d => d.port);

        super("SprocketPostgresProvider", {
            ...args,
            username: username,
            password: password,
            host: host,
            sslmode: 'require',
            port: port,
            database: 'sprocketbot'
        }, opts);

        this.hostname = host;
        this.url = host;
        this.networkId = '12345';
    }
}
