import * as docker from "@pulumi/docker";
import * as pulumi from "@pulumi/pulumi";

import { ConfigFile } from "../../helpers/docker/ConfigFile";
import { TraefikLabels } from "../../helpers/docker/TraefikLabels";
import { HOSTNAME } from "../../constants";
import DefaultLogDriver from "../../helpers/docker/DefaultLogDriver";

interface VaultArgs {
    traefikNetworkId: docker.Network["id"]
    configurationPath: string
}


export class Vault extends pulumi.ComponentResource {

    private readonly network: docker.Network;
    private readonly config: ConfigFile;
    private readonly service: docker.Service;

    readonly networkId: docker.Network["id"];
    readonly address: string

    constructor(name: string, args: VaultArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Services:Vault", name, {}, opts)
        this.network = new docker.Network(`${name}-network`, { driver: "overlay" }, { parent: this })
        this.config = new ConfigFile(`${name}-config`, {
            transformation: this.transformConfiguration.bind(this),
            filepath: args.configurationPath
        }, { parent: this } )

        const url = `vault.${HOSTNAME}`;
        this.address = HOSTNAME === "localhost" ? `http://${url}` : `https://${url}`


        const labels = new TraefikLabels(name)
            .rule(`Host(\`${url}\`)`)
            .targetPort(8200);

        if (HOSTNAME !== "localhost") {
            labels.tls("lets-encrypt-tls");
        }

        this.service = new docker.Service(`${name}-service`, {
            name: name,
            labels: labels.complete,
            taskSpec: {
                containerSpec: {
                    image: "vault:1.10.0",
                    configs: [{
                        configName: this.config.name,
                        configId: this.config.id,
                        fileName: "/vault.hcl"
                    }],
                    commands: ["vault", "server", "-config", "/vault.hcl"]
                },
                logDriver: DefaultLogDriver(name, true),
                networks: [
                    this.network.id,
                    args.traefikNetworkId
                ],
            }
        }, { parent: this })
        
        this.networkId = this.network.id;
        this.registerOutputs({
            networkId: this.networkId
        })

    }

    private transformConfiguration(data: string) {
        const config = new pulumi.Config();
        return pulumi.all([
            config.requireSecret<string>("vault-s3-access-key"),
            config.requireSecret("vault-s3-secret-key"),
            config.require("vault-s3-bucket"),
            config.require("vault-s3-endpoint")
        ]).apply(([accessKey, secretKey, bucket, endpoint]) => `${data}
storage "s3" {
    access_key = "${accessKey}"
    secret_key = "${secretKey}"
    bucket     = "${bucket}"
    endpoint   = "${endpoint}"
    path       = "vault_storage"
}`)
    }

}