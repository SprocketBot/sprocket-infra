import * as pulumi from "@pulumi/pulumi"
import * as postgres from "@pulumi/postgresql";
import * as doppler from "@pulumi/doppler";

import {HOSTNAME} from "../constants";

export interface SprocketPostgresProviderArgs extends Omit<postgres.ProviderArgs, "username" | "password" | "host" | "sslmode" | "port"> {
    dopplerProvider: doppler.Provider,
    postgresHostname: pulumi.Output<string> | string
}

export class SprocketPostgresProvider extends postgres.Provider {
    constructor({dopplerProvider, postgresHostname, ...args}: SprocketPostgresProviderArgs, opts?: pulumi.ResourceOptions) {
        const username = new doppler.Secret("postgres-username", {
            project: "sprocket", // Assuming "sprocket" is your Doppler project name
            config: "infrastructure", // Assuming "infrastructure" is your Doppler config for infrastructure secrets
            name: "POSTGRES_USERNAME"
        }, { provider: dopplerProvider }).value;

        const password = new doppler.Secret("postgres-password", {
            project: "sprocket",
            config: "infrastructure",
            name: "POSTGRES_PASSWORD"
        }, { provider: dopplerProvider }).value;

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
