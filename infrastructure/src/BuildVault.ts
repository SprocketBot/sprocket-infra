import * as pulumi from "@pulumi/pulumi";

import {buildUrn, config, ConfigFile, Traefik, URN_TYPE, Vault} from "@sprocketbot/infra-lib";


interface BuildVaultArgs {
    traefik: Traefik
    configFilepath: string
}

interface BuildVaultResult {
    endpoint: string
    provider: Vault["provider"]
}

export function BuildVault({traefik, configFilepath}: BuildVaultArgs): BuildVaultResult {
    // Wrap everything into a component resource so it can be depended on
    const output = new pulumi.ComponentResource(buildUrn(URN_TYPE.LogicalGroup, "deployed-vault"), "deployed-vault", {}, { dependsOn: [traefik]})


    const vaultConfig = new ConfigFile("infra-vault-config", {
        filepath: configFilepath, vars: {
            accessKey: config.requireSecret<string>("vault-s3-access-key"),
            secretKey: config.requireSecret("vault-s3-secret-key"),
            bucket: config.require("vault-s3-bucket"),
            endpoint: config.require("vault-s3-endpoint")
        }
    }, { parent: output })

    const vault = new Vault("infra-vault", {
        traefikNetId: traefik.network.id,
        config: vaultConfig
    }, {parent: output })

    return {endpoint: vault.endpoint, provider: vault.provider}
}

