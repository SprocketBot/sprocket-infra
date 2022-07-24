import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as vault from "@pulumi/vault"
import {VaultCredentials} from "../../helpers/vault/VaultCredentials";
import DefaultLogDriver from "../../helpers/docker/DefaultLogDriver";
import {TraefikLabels} from "../../helpers/docker/TraefikLabels";
import {HOSTNAME} from "../../constants";
import {buildHost} from "../../helpers/buildHost";

export interface DGraphArgs {
    vaultProvider: vault.Provider
    platformNetworkId?: docker.Network["id"]
    ingressNetworkId: docker.Network["id"]
    environment: string
}

export class DGraph extends pulumi.ComponentResource {
    readonly credentials: VaultCredentials
    readonly hostname: docker.Service["name"]

    private readonly dataVolume: docker.Volume
    // private readonly pluginVolume: docker.Volume
    private readonly zero: docker.Service
    private readonly alpha: docker.Service

    private readonly dgraphNet: docker.Network

    constructor(name: string, args: DGraphArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Services:Neo4j", name, {}, opts)

        this.credentials = new VaultCredentials(`${name}-root-credentials`, {
            username: "dgraph",
            vault: {
                path: `platform/elo/${args.environment}/dgraph`,
                provider: args.vaultProvider
            },
            additionalVaultData: {
                connectionUrl: `${buildHost("bolt", "neo4j", args.environment, HOSTNAME)}:80`,
                webUrl: `https://${buildHost("neo4j", args.environment, HOSTNAME)}`
            }
        }, {parent: this})

        this.dgraphNet = new docker.Network(`${name}-net`, {
            driver: 'overlay'
        }, {
            parent: this
        })

        this.dataVolume = new docker.Volume(`${name}-data-vol`, {name: `${name}-data`}, {
            parent: this,
            retainOnDelete: true
        })

        this.zero = new docker.Service(`${name}-service`, {
            name: `${name}-zero`,
            taskSpec: {
                containerSpec: {
                    image: "dgraph/dgraph:v21.12.0",
                    env: {},
                    commands: [
                      `dgraph`,
                      "zero",
                      `--my=${name}-zero:5080`
                    ],
                },
                logDriver: DefaultLogDriver(`${name}-zero`, true),
                placement: {
                    constraints: [
                        "node.labels.role==storage",
                    ]
                },
                networks: args.platformNetworkId ? [
                    args.platformNetworkId,
                    args.ingressNetworkId,
                    this.dgraphNet.id
                ] : [args.ingressNetworkId, this.dgraphNet.id]
            },
        }, {parent: this})

        this.alpha = new docker.Service(`${name}-alpha`, {
            name: `${name}-alpha`,
            taskSpec: {
                containerSpec: {
                    image: "dgraph/dgraph:v21.12.0",
                    env: {},
                    mounts: [{
                        type: "volume",
                        target: "/dgraph",
                        source: this.dataVolume.id
                    }],
                    commands: [
                        "dgraph",
                        "alpha",
                        `--my=${name}-alpha:7080`,
                        `--zero=${name}-zero:5080`
                    ],
                },
                logDriver: DefaultLogDriver(`${name}-alpha`, true),
                placement: {
                    constraints: [
                        "node.labels.role==storage",
                    ]
                },
                networks: args.platformNetworkId ? [
                    args.platformNetworkId,
                    args.ingressNetworkId,
                    this.dgraphNet.id
                ] : [args.ingressNetworkId, this.dgraphNet.id]
            },
        })


        this.hostname = this.zero.name
    }
}
