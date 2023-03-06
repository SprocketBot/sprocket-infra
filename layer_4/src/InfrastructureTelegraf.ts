import { Telegraf } from 'global/services/telegraf';
import * as vault from "@pulumi/vault";
import * as pulumi from "@pulumi/pulumi";


export const InfrastructureTelegraf = (vaultProvider: vault.Provider,
                                       influxToken: pulumi.Output<string>,
                                       monitoringNetworkId: pulumi.Output<string>) =>
    new Telegraf('infrastructure', {
        configFilePath: `${__dirname}/config/telegraf/infra.conf`,
        global: true,
        additionalNetworkIds: [],
        additionalEnvironmentVariables: {
            HOST_PROC: "/hostfs/proc",
            HOST_SYS: "/hostfs/sys",
            HOST_MOUNT_PREFIX: "/hostfs",
        },
        influxToken,
        monitoringNetworkId,
        providers: { vault: vaultProvider },
        additionalMounts: [
            { type: "bind", readOnly: true, target: "/var/run/docker.sock", source: "/var/run/docker.sock" },
            { type: "bind", readOnly: true, target: "/hostfs/proc", source: "/proc" },
            { type: "bind", readOnly: true, target: "/hostfs/sys", source: "/sys" }
        ]
    })