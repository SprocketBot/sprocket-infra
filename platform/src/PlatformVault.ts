import * as docker from "@pulumi/docker"
import * as postgresql from "@pulumi/postgresql"
import * as pulumi from "@pulumi/pulumi"
import * as vault from "@pulumi/vault"



export type PlatformVaultArgs = {
    environment: string
    vaultProvider: vault.Provider
}

export class PlatformVault extends pulumi.ComponentResource {
    constructor(name: string, args: PlatformVaultArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Platform:VaultSync", name, {}, opts)


    }
}