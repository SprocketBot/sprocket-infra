import * as docker from "@pulumi/docker";
import * as pulumi from "@pulumi/pulumi";

import {LogDriver, ServiceCategory} from "../../utils";

export class SocketProxy extends pulumi.ComponentResource {
    private readonly service: docker.Service
    private readonly network: docker.Network

    readonly networkId: docker.Network["name"]
    readonly serviceName: docker.Service["name"]

    constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Utilities:SocketProxy", name, {}, opts)

        this.network = new docker.Network(`proxy-network`, {
            driver: "overlay"
        }, {parent: this})

        this.service = new docker.Service(`proxy-service`, {
            taskSpec: {
                containerSpec: {
                    image: "tecnativa/docker-socket-proxy:latest@sha256:6c22b9545adc95258af9deffdde6c0ce0a0a70716771e5a4e02d24d1b6e0dda1",
                    env: {
                        CONTAINERS: "1",
                        SERVICES: "1",
                        SWARM: "1",
                        NETWORKS: "1",
                        TASKS: "1",
                    },
                    mounts: [{
                        type: "bind",
                        readOnly: true,
                        source: "/var/run/docker.sock",
                        target: "/var/run/docker.sock"
                    }],
                },
                logDriver: LogDriver("socketProxy", ServiceCategory.UTILITY),
                networksAdvanceds: [{
                    name: this.network.id
                }],
                placement: {
                    constraints: [
                        // Must run on a manager to access the needed information from docker socket.
                        "node.role==manager"
                    ],
                    platforms: [{architecture: "386", os: "linux"}]
                }
            }
        }, {parent: this})

        this.networkId = this.network.id
        this.serviceName = this.service.name
    }
}