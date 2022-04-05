import * as postgres from "@pulumi/postgresql";
import * as vault from "@pulumi/vault";
import {VaultProvider} from "./VaultProvider";
import {HOSTNAME} from "../constants";


const postgresCredentials = vault.generic.getSecretOutput({
    path: "infrastructure/postgres/root"
}, {
    provider: VaultProvider
})

export const PostgresProvider = new postgres.Provider("PostgresProvider", {
    username: postgresCredentials.data.apply(d => d.username),
    password: postgresCredentials.data.apply(d => d.password),
    host: HOSTNAME,
    sslmode: 'disable',
    port: 30000
})