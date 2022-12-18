import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as vault from "@pulumi/vault";

import { HOSTNAME } from "../../constants";
import { TraefikLabels } from "../../helpers/docker/TraefikLabels";
import { VaultCredentials } from "../../helpers/vault/VaultCredentials";

export interface StatpingNgArgs {
    vaultProvider: vault.Provider
}

export class StatpingNg extends pulumi.ComponentResource {
    private readonly dbVolume: docker.Volume;
    private readonly service: docker.Service;

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

        const traefikLabels = new TraefikLabels(name)
            .rule(`Host(\`status.${HOSTNAME}\`)`)
            .tls("lets-encrypt-tls")
            .targetPort(8080)
            .complete;

        // TODO how to get logs from log files?
        this.service = new docker.Service(name, {
            taskSpec: {
                placement: {
                    constraints: [
                        "node.labels.role==ingress"
                    ]
                },
                containerSpec: {
                    image: "adamboutcher/statping-ng:v0.90.78",

                    /** https://github.com/statping-ng/statping-ng/wiki/Environment-Variables */
                    env: {
                        NAME: "Sprocket Internal Status",
                        DESCRIPTION: "Monitor the status of Sprocket services",
                        SAMPLE_DATA: "false",
                        USE_ASSETS: "true",
                        LOGS_MAX_COUNT: "1",
                        ADMIN_USER: this.credentials.username,
                        ADMIN_PASSWORD: this.credentials.password,
                        SQL_FILE: "db/statping.db",
                    },

                    mounts: [{
                        type: "volume",
                        source: this.dbVolume.id,
                        target: "/app/db",
                    }]
                },
            },
            labels: traefikLabels,
        });
    }


}
