import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import { VaultCredentials } from "../../helpers/vault/VaultCredentials";
import * as vault from "@pulumi/vault";
import DefaultLogDriver from "../../helpers/docker/DefaultLogDriver";
import { TraefikLabels } from "../../helpers/docker/TraefikLabels";
import { HOSTNAME } from "../../constants";

export interface MinioArgs {
    vaultProvider: vault.Provider
    ingressNetworkId: docker.Network["id"]
}


export class Minio extends pulumi.ComponentResource {
    readonly url: string
    readonly consoleUrl: string
    readonly hostname: docker.Service["name"]
    readonly credentials: VaultCredentials

    private readonly volume: docker.Volume
    private readonly service: docker.Service

    constructor(name: string, args: MinioArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Services:Minio", name, {}, opts)

        this.url = `files.${HOSTNAME}`
        this.consoleUrl = `minio.${HOSTNAME}`

        this.credentials = new VaultCredentials(`${name}-root-credentials`, {
            username: "minio_admin",
            vault: {
                path: "infrastructure/data/minio/root",
                provider: args.vaultProvider
            }
        }, { parent: this })

        this.volume = new docker.Volume(`${name}-volume`, {
            driverOpts: {
                "size": "10G"
            }
        }, { parent: this, retainOnDelete: true })

        this.service = new docker.Service(`${name}-service`, {
            taskSpec: {
                containerSpec: {
                    image: "minio/minio:RELEASE.2022-04-30T22-23-53Z",
                    mounts: [{
                        type: "volume",
                        target: "/data",
                        source: this.volume.id
                    }],
                    args: [`server`, `/data`, `--console-address`, `:9001`],
                    env: {
                        MINIO_ROOT_USER: this.credentials.username,
                        MINIO_ROOT_PASSWORD: this.credentials.password,
                        "MINIO_LOG_LEVEL": "WARN",
                        "LOG_LEVEL": "WARN"
                    },
                },
                logDriver: DefaultLogDriver("minio", true),
                networks: [
                    args.ingressNetworkId
                ],
                placement: {
                    constraints: [
                        "node.labels.role==storage",
                    ]
                }
            },
            labels: [
                ...new TraefikLabels("minio-endpoint")
                    .rule(`Host(\`${this.url}\`)`)
                    .tls("lets-encrypt-tls")
                    .targetPort(9000)
                    .service("minio-endpoint@docker")
                    .complete,
                ...new TraefikLabels("minio-console")
                    .rule(`Host(\`${this.consoleUrl}\`)`)
                    .tls("lets-encrypt-tls")
                    .targetPort(9001)
                    .service("minio-console@docker")
                    .complete,
            ]
        })

        this.hostname = this.service.name
    }
}