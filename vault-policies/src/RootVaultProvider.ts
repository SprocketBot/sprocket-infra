import {HOSTNAME} from "global/constants";
import * as vault from "@pulumi/vault"
import * as pulumi from "@pulumi/pulumi"

const config = new pulumi.Config()

export const RootVaultProvider = new vault.Provider("vaultProvider", {
    address: `https://vault.${HOSTNAME}`,
    token: config.requireSecret("vault-token")
})