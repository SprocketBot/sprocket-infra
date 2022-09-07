import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as vault from "@pulumi/vault"

import DefaultLogDriver from "../../helpers/docker/DefaultLogDriver"
import {ConfigFile} from "../../helpers/docker/ConfigFile"
import {TraefikLabels} from "../../helpers/docker/TraefikLabels"
import { Telegraf } from '../telegraf';


export interface RabbitMqArgs {
    configFilepath: string
    ingressNetworkId: docker.Network["id"]
    platformNetworkId: docker.Network["id"]
    url: string

    monitoring?: {
        influxToken: string | pulumi.Output<string>,
        monitoringNetworkId: docker.Network["id"],
    }
}

export class RabbitMq extends pulumi.ComponentResource {
    private readonly config: ConfigFile

    private readonly volume: docker.Volume
    private readonly service: docker.Service

    private readonly telegraf?: Telegraf

    readonly hostname: docker.Service["name"]

    readonly url: string
    readonly managementUrl: string

    constructor(name: string, args: RabbitMqArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Services:RabbitMq", name, {}, opts)

        this.url = args.url
        this.managementUrl = `management.${args.url}`

        this.config = new ConfigFile(`${name}-config`, {
            filepath: args.configFilepath
        }, {parent: this})

        this.volume = new docker.Volume(`${name}-data`, {}, {retainOnDelete: true, parent: this})

        const networks = [
            args.platformNetworkId,
            args.ingressNetworkId,
        ]
        if (args.monitoring) {
            networks.push(args.monitoring.monitoringNetworkId)
        }

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
                networks: networks,
                logDriver: DefaultLogDriver("rabbitmq", true),
                placement: {
                    constraints: [
                        "node.labels.role==storage",
                    ]
                },
            },
            labels: args.url
                ? [
                    ...new TraefikLabels(`${name}-management`)
                        .rule(`Host(\`management.${args.url}\`)`)
                        .tls("lets-encrypt-tls")
                        .targetPort(15672)
                        .complete,
                    ...new TraefikLabels(`${name}-management`, "tcp")
                        .rule(`HostSNI(\`${args.url}\`)`)
                        .tls("lets-encrypt-tls")
                        .targetPort(5672)
                        .complete
                ] : []
        }, {parent: this})

        if (args.monitoring) {
            this.telegraf = new Telegraf(`${name}-telegraf-agent`, {
                additionalEnvironmentVariables: {
                    RMQ_USER: "guest",
                    RMQ_PASS: "guest",
                    RMQ_HOST: this.service.name
                },
                additionalNetworkIds: [],
                monitoringNetworkId: args.monitoring.monitoringNetworkId,
                configFilePath: `${__dirname}/telegraf.rmq.conf`,
                influxToken: args.monitoring.influxToken,
            }, { parent: this })
        }

        this.hostname = this.service.name
    }

}
