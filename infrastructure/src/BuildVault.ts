import * as docker from "@pulumi/docker";
import {config, ConfigFile, Traefik, Vault, VaultDiscordOidc} from "@sprocketbot/infra-lib";


interface BuildVaultArgs {
    traefik: Traefik
    configFilepath: string
}

interface BuildVaultResult {
    endpoint: string
}

export function BuildVault({traefik, configFilepath}: BuildVaultArgs): BuildVaultResult {
    const vaultConfig = new ConfigFile("infra-vault-config", {
        filepath: configFilepath, vars: {
            accessKey: config.requireSecret<string>("vault-s3-access-key"),
            secretKey: config.requireSecret("vault-s3-secret-key"),
            bucket: config.require("vault-s3-bucket"),
            endpoint: config.require("vault-s3-endpoint")
        }
    })

    const vault = new Vault("infra-vault", {
        traefikNetId: traefik.network.id,
        config: vaultConfig
    }, {dependsOn: [traefik]})

    return {endpoint: vault.endpoint}
}

