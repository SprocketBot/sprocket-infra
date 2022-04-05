import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";

import DefaultLogDriver from "global/docker/DefaultLogDriver"

export interface LokiArgs {
    monitoringNetworkId: docker.Network["id"]
}

export class Loki extends pulumi.ComponentResource {
    private readonly service: docker.Service
    private readonly volume: docker.Volume

    constructor(name: string, args: LokiArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Services:Loki", name, {}, opts);

        this.volume = new docker.Volume(`${name}-volume`, {}, { parent: this })

        this.service = new docker.Service(`${name}-service`, {
            name: "loki",
            taskSpec: {
                containerSpec: {
                    image: "grafana/loki:main-1a7b170",
                    mounts: [{
                        type: "volume",
                        source: this.volume.id,
                        target: "/data"
                    }]
                },
                logDriver: DefaultLogDriver("loki", true),
                networks: [
                    args.monitoringNetworkId
                ],
                placement: {
                    constraints: [
                        "node.role==manager"
                    ]
                }
            }
        }, { parent: this })
    }
}