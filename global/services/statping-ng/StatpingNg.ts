import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as vault from "@pulumi/vault";

import { HOSTNAME } from "../../constants";
import { TraefikLabels } from "../../helpers/docker/TraefikLabels";
import { VaultCredentials } from "../../helpers/vault/VaultCredentials";
import DefaultLogDriver from "../../helpers/docker/DefaultLogDriver";
import { ConfigFile } from "../../helpers/docker/ConfigFile";

export interface StatpingNgArgs {
    ingressNetworkId: docker.Network["id"];
    vaultProvider: vault.Provider;
    servicesYmlFilePath: string;
}

export class StatpingNg extends pulumi.ComponentResource {
    private readonly service: docker.Service;
    private readonly dbVolume: docker.Volume;
    private readonly servicesConfig: ConfigFile;

    private readonly credentials: VaultCredentials;
    
    constructor(name: string, args: StatpingNgArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Services:StatpingNg", name, {}, opts);

        this.credentials = new VaultCredentials(`${name}-credentials`, {
            username: "admin",
            vault: {
                path: "infrastructure/statping",
                provider: args.vaultProvider,
            },
        }, { parent: this })

        this.dbVolume = new docker.Volume(`${name}-db`, {}, { parent: this });

        this.servicesConfig = new ConfigFile(`${name}-config`, {
            filepath: args.servicesYmlFilePath,
        }, { parent: this });

        const traefikLabels = new TraefikLabels(name)
            .rule(`Host(\`status.${HOSTNAME}\`)`)
            .tls("lets-encrypt-tls")
            .targetPort(8080)
            .complete;

        this.service = new docker.Service(name, {
            taskSpec: {
                placement: {
                    constraints: [
                        "node.labels.role==ingress"
                    ]
                },
                logDriver: DefaultLogDriver(name, true),
                networks: [args.ingressNetworkId],
                containerSpec: {
                    image: "adamboutcher/statping-ng:v0.90.78",

                    /** https://github.com/statping-ng/statping-ng/wiki/Environment-Variables */
                    env: {
                        NAME: "Sprocket Internal Status",
                        DESCRIPTION: "Monitor the status of Sprocket services",
                        SAMPLE_DATA: "false",
                        DISABLE_LOGS: "true",
                        ADMIN_USER: this.credentials.username,
                        ADMIN_PASSWORD: this.credentials.password,
                        DB_CONN: 'sqlite',
                        SQL_FILE: "db/statping.db",
                    },

                    mounts: [{
                        type: "volume",
                        source: this.dbVolume.id,
                        target: "/app/db",
                    }],

                    configs: [{
                        configName: this.servicesConfig.name,
                        configId: this.servicesConfig.id,
                        fileName: "/app/services.yml",
                    }]
                },
            },
            labels: traefikLabels,
        });
    }
}
