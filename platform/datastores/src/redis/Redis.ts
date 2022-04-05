import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";

import DefaultLogDriver from "global/docker/DefaultLogDriver"
import {ConfigFile} from "global/docker/ConfigFile"
import {VaultCredentials} from "global/vault/VaultCredentials"


export interface RedisArgs {
    configFilepath: string
}

export class Redis extends pulumi.ComponentResource {
    private readonly credentials: VaultCredentials
    private readonly config: ConfigFile

    private readonly volume: docker.Volume
    private readonly network: docker.Network
    private readonly service: docker.Service

    readonly networkId: docker.Network["id"]
    readonly hostname: docker.Service["name"]

    constructor(name: string, args: RedisArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Services:Redis", name, {}, opts)

        this.credentials = new VaultCredentials(`${name}-root-credentials`, {
            username: "",
            vault: {
                path: "infrastructure/redis"
            }
        }, {parent: this})


        this.config = new ConfigFile(`${name}-config`, {
            filepath: args.configFilepath
        }, {parent: this})

        this.volume = new docker.Volume(`${name}-volume`, {}, {parent: this, retainOnDelete: true})

        this.network = new docker.Network(`${name}-network`, {driver: "overlay"}, {parent: this})

        this.service = new docker.Service("redis-primary", {
            endpointSpec: {
                ports: [{
                    publishedPort: 30001,
                    targetPort: 6379,
                    protocol: "tcp"
                }]
            },
            taskSpec: {
                containerSpec: {
                    image: "redislabs/rejson:2.0.7",
                    mounts: [{
                        type: "volume",
                        target: "/data",
                        source: this.volume.id
                    }],
                    args: [
                        "--requirepass",
                        this.credentials.password
                    ],
                    configs: [{
                        configId: this.config.id,
                        configName: this.config.name,
                        fileName: "/usr/local/etc/redis/redis.conf"
                    }]
                },
                logDriver: DefaultLogDriver("redis", true),
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