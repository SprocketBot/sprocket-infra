// Handles self
import {Postgres, VaultPolicies} from "global/services";
import {Monitoring} from "./monitoring";
import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";
import * as postgres from "@pulumi/postgresql"
import {LayerOne, LayerOneExports} from "global/refs"

import {SprocketPostgresProvider} from "global/providers/SprocketPostgresProvider"

export const policies = new VaultPolicies("policies", {})

const vaultProvider = new vault.Provider("VaultProvider", {
    address: LayerOne.stack.requireOutput(LayerOneExports.VaultAddress),
    token: policies.infraToken.clientToken
})

export const pg = new Postgres("postgres", { vaultProvider: vaultProvider })

const postgresProvider = new SprocketPostgresProvider({
    vaultProvider: vaultProvider,
    postgresCredentials: pg.credentials
}, {  }) as postgres.Provider

export const monitoring = new Monitoring("monitoring", {
    postgres: pg,
    exposeInfluxUi: true,
    ingressNetworkId: LayerOne.stack.requireOutput(LayerOneExports.IngressNetwork) as pulumi.Output<string>,

    providers: {
        vault: vaultProvider,
        postgres: postgresProvider
    }
}, {dependsOn: [pg]})