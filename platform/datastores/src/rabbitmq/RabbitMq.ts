import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";

import DefaultLogDriver from "global/docker/DefaultLogDriver"
import {ConfigFile} from "global/docker/ConfigFile"
import {TraefikLabels} from "global/docker/TraefikLabels"
import {HOSTNAME} from "global/constants"
import {coreStack} from "global/refs"

export interface RabbitMqArgs {
    configFilepath: string
}

// TODO: https://hub.docker.com/r/bitnami/wal-g

export class RabbitMq extends pulumi.ComponentResource {
    private readonly config: ConfigFile

    private readonly volume: docker.Volume
    private readonly network: docker.Network
    private readonly service: docker.Service

    readonly networkId: docker.Network["id"]
    readonly hostname: docker.Service["name"]

    constructor(name: string, args: RabbitMqArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Services:RabbitMq", name, {}, opts)

        this.config = new ConfigFile(`${name}-config`, {
            filepath: args.configFilepath
        }, { parent: this })

        this.volume = new docker.Volume(`${name}-data`, {}, {retainOnDelete: true, parent: this})
        this.network = new docker.Network(`${name}-network`, {driver: 'overlay'}, {parent: this})

        this.service = new docker.Service(`${name}-service`, {
            taskSpec: {
                containerSpec: {
                    image: "rabbitmq:3.9.14-management-alpine",
                    hostname: "{{.Node.Hostname}}",
                    configs: [{
                        configName: this.config.name,
                        configId: this.config.id,
                        fileName: "/etc/rabbitmq/rabbitmq.conf"
                    }],
                    mounts: [{
                        type: "volume",
                        source: this.volume.name,
                        target: "/var/lib/rabbitmq"
                    }],
                },
                networks: [
                    this.network.id,
                    coreStack.requireOutput("ingressNetwork")
                ],
                logDriver: DefaultLogDriver("rabbitmq", true),
            },
            labels: new TraefikLabels(`${name}`)
                .rule(`Host(\`rabbitmq.${HOSTNAME}\`)`)
                .tls("lets-encrypt-tls")
                .targetPort(15672)
                .complete
        }, { parent: this })
        this.networkId = this.network.id
        this.hostname = this.service.name

        this.registerOutputs({
            networkId: this.networkId,
            hostname: this.service.name
        })
    }

}