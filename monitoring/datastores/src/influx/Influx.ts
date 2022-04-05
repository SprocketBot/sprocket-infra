import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";

import DefaultLogDriver from "global/docker/DefaultLogDriver"
import {VaultCredentials} from "global/vault/VaultCredentials"
import {TraefikLabels} from "global/docker/TraefikLabels"
import {HOSTNAME} from "global/constants"
import {coreStack} from "global/refs"

export interface InfluxArgs {
    monitoringNetworkId: docker.Network["id"],
    exposeUi: boolean
}


// TODO: Consider creating a CustomResource to sit next to this, that would be responsible for creating / destroying influxdb buckets.
export class Influx extends pulumi.ComponentResource {
    private readonly credentials: VaultCredentials
    private readonly service: docker.Service
    private readonly volume: docker.Volume
    private readonly network: docker.Network

    readonly networkId: docker.Network["id"]

    constructor(name: string, args: InfluxArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Services:Influx", name, {} ,opts)
        this.credentials = new VaultCredentials(`${name}-credentials`, {
            username: "admin", vault: {path: "infrastructure/influx"}
        }, { parent: this })

        this.volume = new docker.Volume(`${name}-volume`, {}, { parent: this })

        this.network = new docker.Network(`${name}-network`, { driver: "overlay" }, { parent: this })
        this.networkId = this.network.id

        const traefikLabels = new TraefikLabels(name, "http")
            .rule(`Host(\`influx.${HOSTNAME}\`)`)
            .tls("lets-encrypt-tls")
            .targetPort(8086)
            .entryPoints("websecure")
            .complete



        this.service = new docker.Service(`${name}-service`, {
            // Pin the name to prevent desync when used in applications
            // i.e. if this is updated and the applications are not, they will point to the wrong url
            name: `${name}`,
            taskSpec: {
                containerSpec: {
                    image: "influxdb:2.1-alpine",
                    env: {
                        DOCKER_INFLUXDB_INIT_MODE: "setup",
                        DOCKER_INFLUXDB_INIT_USERNAME: this.credentials.username,
                        DOCKER_INFLUXDB_INIT_PASSWORD: this.credentials.password,
                        DOCKER_INFLUXDB_INIT_RETENTION: "30d",
                        DOCKER_INFLUXDB_INIT_ORG: "sprocket",
                        DOCKER_INFLUXDB_INIT_BUCKET: "metrics"
                    },
                    mounts: [{
                        type: "volume",
                        source: this.volume.id,
                        target: "/var/lib/influxdb2"
                    }]
                },
                logDriver: DefaultLogDriver(`${name}`, true),
                networks: [
                    args.monitoringNetworkId,
                    this.network.id,
                    coreStack.requireOutput("ingressNetwork")
                ],
                placement: {
                    constraints: [
                        "node.role==manager"
                    ]
                }
            },
            labels: args.exposeUi ? traefikLabels : []
        }, { parent: this })

        this.registerOutputs({
            networkId: this.networkId
        })
    }
}