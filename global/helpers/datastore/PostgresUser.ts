import * as pulumi from "@pulumi/pulumi";
import * as postgres from "@pulumi/postgresql";
import * as vault from "@pulumi/vault";

import {VaultCredentials} from "../vault/VaultCredentials";

export interface PostgresUserArgs {
    username: string
    roleArgs?: Partial<Omit<postgres.RoleArgs, 'name' | 'login' | 'password'>>,
    providers: {
        vault: vault.Provider,
        postgres: postgres.Provider
    }
    keepers?: Record<string, string>
}

export class PostgresUser extends pulumi.ComponentResource {
    private readonly credentials: VaultCredentials;
    private readonly role: postgres.Role;

    readonly username: pulumi.Output<string>
    readonly password: pulumi.Output<string>

    constructor(name: string, args: PostgresUserArgs, opts?: pulumi.ComponentResourceOptions) {
        super("sprocket:PostgresUser", name, {}, opts)

        this.credentials = new VaultCredentials(`${name}-pw`, {
            vault: {path: `infrastructure/postgres/${args.username}`, provider: args.providers.vault},
            username: args.username,
            passwordOptions: {
                keepers: args.keepers
            }
        }, { parent: this })

        this.role = new postgres.Role(`${name}-role`, {
            name: this.credentials.username,
            login: true,
            password: this.credentials.password,
            ...args.roleArgs
        }, { provider: args.providers.postgres, parent: this })

        this.username = this.credentials.username
        this.password = this.credentials.password
    }
}
