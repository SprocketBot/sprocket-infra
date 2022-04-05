import * as pulumi from "@pulumi/pulumi";
import * as postgres from "@pulumi/postgresql";

import {VaultCredentials} from "../vault/VaultCredentials";
import {PostgresProvider} from "../providers/PostgresProvider";
import {VaultProvider} from "../providers/VaultProvider";

export interface PostgresUserArgs {
    username: string
    roleArgs?: Partial<Omit<postgres.RoleArgs, 'name' | 'login' | 'password'>>
}

export class PostgresUser extends pulumi.ComponentResource {
    private readonly credentials: VaultCredentials;
    private readonly role: postgres.Role;

    readonly username: pulumi.Output<string>
    readonly password: pulumi.Output<string>

    constructor(name: string, args: PostgresUserArgs, opts?: pulumi.ComponentResourceOptions) {
        super("sprocket:PostgresUser", name, {}, opts)

        this.credentials = new VaultCredentials(`${name}-pw`, {
            vault: {path: `infrastructure/postgres/${args.username}`},
            username: args.username
        }, { parent: this, provider: VaultProvider })

        this.role = new postgres.Role(`${name}-role`, {
            name: this.credentials.username,
            login: true,
            password: this.credentials.password,
            ...args.roleArgs
        }, { provider: PostgresProvider, parent: this })

        this.username = this.credentials.username
        this.password = this.credentials.password
    }
}