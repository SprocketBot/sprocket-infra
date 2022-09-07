import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";

import {ConfigFile} from "../../helpers/docker/ConfigFile"

export interface TelegrafArgs {
    configFilePath: string,
    monitoringNetworkId: docker.Network["id"],
    additionalNetworkIds: docker.Network["id"][],
    additionalEnvironmentVariables: Record<string, string | pulumi.Output<string>>,
    influxToken: string | pulumi.Output<string>
    options?: {
        isGlobal?: boolean
        managerOnly?: boolean
        mountDockerSocket?: boolean
    }
}

export class Telegraf extends pulumi.ComponentResource {
    private readonly service: docker.Service;
    private readonly config: ConfigFile

    constructor(name: string, args: TelegrafArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Services:Telegraf", name, {}, opts);

        this.config = new ConfigFile(`${name}-config`, {
            filepath: args.configFilePath
        }, { parent: this })


        this.service = new docker.Service(`${name}-service`, {
            mode: {
                global: args.options?.isGlobal ?? false
            },
            taskSpec: {
                placement: {
                    constraints: args.options?.managerOnly ? [
                        "node.role==manager"
                    ] : []
                },
                containerSpec: {
                    user: args.options?.mountDockerSocket ? "root" : undefined,
                    groups: args.options?.mountDockerSocket ? ["root"] : undefined,
                    image: "telegraf:1.23-alpine",
                    env: {
                        ...args.additionalEnvironmentVariables,
                        HOSTNAME: "{{.Node.Hostname}}",
                        INFLUX_HOSTNAME: "influx",
                        INFLUX_TOKEN: args.influxToken,
                    },
                    configs: [{
                        configId: this.config.id,
                        configName: this.config.name,
                        fileName: "/etc/telegraf/telegraf.conf"
                    }],
                    mounts: args.options?.mountDockerSocket ? [{
                        source: "/var/run/docker.sock",
                        target: "/var/run/docker.sock",
                        type: "bind"
                    }] : []
                },
                networks: [
                    ...args.additionalNetworkIds,
                    args.monitoringNetworkId
                ]
            }
        }, { parent: this, dependsOn: [this.config] })
    }
}
