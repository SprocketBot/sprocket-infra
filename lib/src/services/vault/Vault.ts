import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as vault from "@pulumi/vault";
import {BASE_HOSTNAME, buildUrn, config, URN_TYPE} from "../../constants/pulumi";
import {TraefikHttpLabel, LogDriver, ServiceCategory} from "../../utils";
import {EntryPoint} from "../../constants/traefik";
import {ConfigFile} from "../../utils";
import {VaultPulumiAuth} from "./VaultPulumiAuth";
import {VaultInitializer} from "./VaultInitializer";
import {VaultBaseConfig} from "./VaultBaseConfig";

export type VaultArgs = {
    config: ConfigFile,
    traefikNetId: docker.Network["id"]
}

const vaultImage = "hashicorp/vault@sha256:80de97cc135e6250952da806468f8c348bef7bc31fd79bb8a10c67e947fea5d4";

export class Vault extends pulumi.ComponentResource {
    private readonly service: docker.Service;
    readonly endpoint: string;
    readonly provider: vault.Provider;
    readonly approleCreds: { secretId: pulumi.Output<string>, roleId: pulumi.Output<string> };

    constructor(name: string, args: VaultArgs, opts?: pulumi.ComponentResourceOptions) {
        super(buildUrn(URN_TYPE.Service, "Vault"), name, {}, opts)

        const hostname = `vault.${BASE_HOSTNAME}`
        this.endpoint = `https://${hostname}`

        this.service = new docker.Service(`service`, {
            labels: [
                ...new TraefikHttpLabel(name)
                    .rule(`Host(\`${hostname}\`)`)
                    .entryPoints(EntryPoint.HTTPS)
                    .targetPort(8200)
                    .tls("lets-encrypt-tls")
                    .complete
            ],
            taskSpec: {
                containerSpec: {
                    // hashicorp/vault:1.14
                    image: vaultImage,
                    configs: [{
                        configName: args.config.name,
                        configId: args.config.id,
                        fileName: "/vault.hcl"
                    }],
                    commands: ["vault", "server", "-config", "/vault.hcl"],
                },
                logDriver: LogDriver("vault", ServiceCategory.INFRASTRUCTURE),
                networksAdvanceds: [{
                    name: args.traefikNetId
                }]
            }
        }, {parent: this})

        const vaultInitializer = new VaultInitializer("initializer", {
            vaultService: this.service,
            vaultImage: vaultImage,
            traefikNetId: args.traefikNetId,
            vaultEndpoint: this.endpoint
        }, {parent: this})


        const internalProvider = new vault.Provider("root-provider", {
            token: vaultInitializer.rootToken,
            address: vaultInitializer.vaultHealthy.apply(($endpoint: string) => $endpoint)
        }, {parent: this})

        const auth = new VaultPulumiAuth("auth", {
            address: vaultInitializer.vaultHealthy.apply(($endpoint: string) => $endpoint),
            rootProvider: internalProvider
        }, {parent: this})

        const baseConfig = new VaultBaseConfig("base-config", {
            unsealKeys: vaultInitializer.unsealKeys
        }, {parent: this, provider: auth.provider})

        this.provider = auth.provider
        this.approleCreds = auth.approleCreds
    }
}