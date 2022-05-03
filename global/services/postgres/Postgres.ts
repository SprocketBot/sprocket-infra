import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as vault from "@pulumi/vault";

import DefaultLogDriver from "../../helpers/docker/DefaultLogDriver"
import {VaultCredentials} from "../../helpers/vault/VaultCredentials"
import {TraefikLabels} from "../../helpers/docker/TraefikLabels";
import {HOSTNAME} from "../../constants";

export interface PostgresArgs {
    vaultProvider: vault.Provider
    ingressNetworkId: docker.Network["id"]
}

// TODO: https://hub.docker.com/r/bitnami/wal-g

export class Postgres extends pulumi.ComponentResource {
    private readonly volume: docker.Volume
    private readonly network: docker.Network
    private readonly service: docker.Service

    readonly networkId: docker.Network["id"]
    readonly hostname: docker.Service["name"]
    readonly url: string
    readonly credentials: VaultCredentials

    constructor(name: string, args: PostgresArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Services:Postgres", name, {}, opts)

        this.url = `db.${HOSTNAME}`

        this.credentials = new VaultCredentials(`${name}-root-credentials`, {
            username: "postgres",
            vault: {
                path: "infrastructure/postgres/root",
                provider: args.vaultProvider
            }
        }, {parent: this})


        this.volume = new docker.Volume(`${name}-volume`, {}, {parent: this, retainOnDelete: true})

        this.network = new docker.Network(`${name}-network`, {driver: "overlay"}, {parent: this})

        this.service = new docker.Service(`${name}-primary`, {
            endpointSpec: {
                ports: [{
                    publishedPort: 30000,
                    targetPort: 5432,
                    publishMode: "ingress"
                }]
            },
            taskSpec: {
                containerSpec: {
                    image: "timescale/timescaledb@sha256:01b6eb2fa57ce9d9b2129c997def88d39a2d8d8573f1e8619b279cba492f20b9",
                    mounts: [{
                        type: "volume",
                        target: "/var/lib/postgresql/data",
                        source: this.volume.id
                    }],
                    env: {
                        POSTGRES_USER: this.credentials.username,
                        POSTGRES_PASSWORD: this.credentials.password
                    }
                },
                logDriver: DefaultLogDriver("postgres", true),
                placement: {
                    constraints: [
                        "node.labels.role==storage",
                    ]
                },
                networks: [
                    this.network.id,
                    args.ingressNetworkId
                ]
            },
            labels: new TraefikLabels("postgres", "tcp")
                .rule(`HostSNI(\`${this.url}\`)`)
                .tls("lets-encrypt-tls")
                .targetPort(5432)
                .complete
        }, {parent: this})

        this.networkId = this.network.id
        this.hostname = this.service.name

        this.registerOutputs({
            networkId: this.networkId,
            hostname: this.hostname
        })
    }
}