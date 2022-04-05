import * as vault from "@pulumi/vault";
import * as pulumi from "@pulumi/pulumi";
import {HOSTNAME} from "../constants";
const config = new pulumi.Config();

export const VaultProvider = new vault.Provider("vaultProvider", {
    address: `https://vault.${HOSTNAME}`,
    token: config.requireSecret("vault-token")
} , {

})

config.requireSecret("vault-token").apply(console.log)