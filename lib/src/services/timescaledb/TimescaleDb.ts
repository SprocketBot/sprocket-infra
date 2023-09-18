import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as postgres from "@pulumi/postgresql"
import {BASE_HOSTNAME, buildUrn, URN_TYPE} from "../../constants/pulumi";
import {ConfigFile, LogDriver, ServiceCategory, TraefikTcpLabel, UserPassCredential} from "../../utils";
import {Role, RoleRestriction} from "../../constants/docker-node-labels";
import {EntryPoint} from "../../constants/traefik";
import {TimescaleVault} from "./TimescaleVault";

export type TimescaleDbArgs = {
    ingressNetId: Outputable<string>,
    configs?: {
        "pg_hba.conf"?: ConfigFile,
        "postgresql.conf"?: ConfigFile
    }
}

export class TimescaleDb extends pulumi.ComponentResource {
    private readonly service: docker.Service
    private readonly network: docker.Network
    private readonly volume: docker.Volume
    private readonly rootAcct: UserPassCredential

    readonly hostname: Outputable<string>
    readonly port = 443
    readonly vault: TimescaleVault;
    readonly provider: postgres.Provider;

    constructor(name: string, args: TimescaleDbArgs, opts?: pulumi.ComponentResourceOptions) {
        super(buildUrn(URN_TYPE.Service, "TimescaleDb"), name, {}, opts)

        this.volume = new docker.Volume("timescaledb", {}, {parent: this})
        this.network = new docker.Network("timescaledb", {attachable: true, driver: "overlay"}, {parent: this})
        this.rootAcct = new UserPassCredential("root-acct", {
            path: {name: "sudo/timescaledb/root"},
            freeze: true,
            passwordArgs: {
                special: false
            }
        }, {parent: this})

        const serviceConfigs: docker.types.input.ServiceTaskSpecContainerSpec["configs"] = []

        if (args.configs?.["pg_hba.conf"]) {
            serviceConfigs.push({
                configName: args.configs?.["pg_hba.conf"].name,
                configId: args.configs?.["pg_hba.conf"].id,
                fileName: "/etc/postgresql/pg_hba.conf",
                fileUid: "70",
                fileGid: "70"
            })
        }

        if (args.configs?.["postgresql.conf"]) {
            serviceConfigs.push({
                configName: args.configs?.["postgresql.conf"].name,
                configId: args.configs?.["postgresql.conf"].id,
                fileName: "/etc/postgresql/postgresql.conf",
                fileUid: "70",
                fileGid: "70"
            })
        }

        this.hostname = `db.${BASE_HOSTNAME}`


        this.service = new docker.Service("timescaledb", {
            taskSpec: {
                containerSpec: {
                    image: "timescale/timescaledb:latest-pg15@sha256:d3951da701191387caab2285a61c2828ae0129ce7b45518add878ccdf411be74",
                    // Postgres User
                    user: "70",
                    groups: ["70"],
                    // commands: [
                    //     "postgres",
                    //     "-c",
                    //     `config_file=${args.configs?.["postgresql.conf"] ? "/etc/postgresql/postgresql.conf" : "/var/lib/postgresql/data/postgresql.conf"}`
                    // ],
                    mounts: [{
                        type: "volume",
                        target: "/var/lib/postgresql/data",
                        source: this.volume.id,
                    }, {
                        type: "tmpfs",
                        target: "/dev/shm"
                    }],
                    configs: serviceConfigs,
                    env: {
                        POSTGRES_USER: this.rootAcct.username,
                        POSTGRES_PASSWORD: this.rootAcct.password,
                        PGDATA: "/var/lib/postgresql/data/pgdata"
                    }

                },
                logDriver: LogDriver("timescaledb", ServiceCategory.INFRASTRUCTURE),
                networksAdvanceds: [{name: this.network.id}, {name: args.ingressNetId}],
                placement: {
                    constraints: [RoleRestriction(Role.PRIMARY_STORAGE)],
                    platforms: [] // TODO: Identify what is expected here, and/or ignore changes to this field.
                }
            },
            labels: new TraefikTcpLabel("timescaledb")
                .rule(`HostSNI(\`${this.hostname}\`)`)
                .tls("lets-encrypt")
                .targetPort(5432)
                .entryPoints(EntryPoint.HTTPS)
                .complete
        }, {parent: this})


        const vaultHookup = new TimescaleVault("vault", {
            host: this.service.name, // TODO: Verify that we can (should) use the traefik network for this
            username: this.rootAcct.username,
            password: this.rootAcct.password,
            port: 5432,
            // If we move to external connections; enable SSL
        }, { parent: this })

        this.vault = vaultHookup

        this.provider = new postgres.Provider("provider", {
            username: this.rootAcct.username,
            password: this.rootAcct.password,
            host: this.hostname,
            port: this.port,
            sslmode: "require",
            superuser: true
        }, { parent: this })
    }
}
