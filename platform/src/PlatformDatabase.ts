import * as docker from "@pulumi/docker"
import * as postgres from "@pulumi/postgresql"
import * as pulumi from "@pulumi/pulumi"
import * as vault from "@pulumi/vault"

import {LayerTwo, LayerTwoExports} from "global/refs"
import {PlatformDatastore} from "./PlatformDatastore";
import * as postgresql from "@pulumi/postgresql";
import {PostgresUser} from "global/helpers/datastore/PostgresUser";


const config = new pulumi.Config()

export interface PlatformDatabaseArgs {
    postgresHostname: pulumi.Output<string> | string
    postgresProvider: postgres.Provider
    vaultProvider: vault.Provider
    environmentSubdomain: string
}


export class PlatformDatabase extends pulumi.ComponentResource {
    readonly database: postgresql.Database
    readonly host: string | pulumi.Output<string>
    readonly credentials: PostgresUser

    constructor(name: string, args: PlatformDatabaseArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Platform:Database", name, {}, opts)

        this.host = args.postgresHostname

        this.credentials = new PostgresUser(`${name}-db-user`, {
            providers: {postgres: args.postgresProvider, vault: args.vaultProvider},
            username: `sprocket_${args.environmentSubdomain}`
        })

        this.database = new postgresql.Database(`${name}-database`, {
            name: `sprocket_${args.environmentSubdomain}`,
            owner: this.credentials.username
        }, {parent: this, provider: args.postgresProvider})

    }
}