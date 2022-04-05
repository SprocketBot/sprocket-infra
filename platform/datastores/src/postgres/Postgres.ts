import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";

import DefaultLogDriver from "global/docker/DefaultLogDriver"
import {VaultCredentials} from "global/vault/VaultCredentials"

export interface PostgresArgs {
}

// TODO: https://hub.docker.com/r/bitnami/wal-g

export class Postgres extends pulumi.ComponentResource {
    private readonly credentials: VaultCredentials

    private readonly volume: docker.Volume
    private readonly network: docker.Network
    private readonly service: docker.Service

    readonly networkId: docker.Network["id"]
    readonly hostname: docker.Service["name"]

    constructor(name: string, args: PostgresArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Services:Postgres", name, {}, opts)

        this.credentials = new VaultCredentials(`${name}-root-credentials`, {
            username: "postgres",
            vault: {
                path: "infrastructure/postgres/root"
            }
        }, {parent: this})


        this.volume = new docker.Volume(`${name}-volume`, {}, {parent: this, retainOnDelete: true})

        this.network = new docker.Network(`${name}-network`, {driver: "overlay"}, {parent: this})

        this.service = new docker.Service("postgres-primary", {
            endpointSpec: {
                ports: [{
                    publishedPort: 30000,
                    targetPort: 5432,
                    publishMode: "ingress"
                }]
            },
            taskSpec: {
                containerSpec: {
                    image: "timescale/timescaledb:2.6.0-pg13",
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
                        "node.role==manager"
                    ]
                },
                networks: [
                    this.network.id
                ]
            }
        }, {parent: this})
        this.networkId = this.network.id
        this.hostname = this.service.name

        this.registerOutputs({
            networkId: this.networkId,
            hostname: this.hostname
        })
    }
}