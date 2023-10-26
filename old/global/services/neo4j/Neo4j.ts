import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as vault from "@pulumi/vault";
import { VaultCredentials } from "../../helpers/vault/VaultCredentials";
import DefaultLogDriver from "../../helpers/docker/DefaultLogDriver";
import { TraefikLabels } from "../../helpers/docker/TraefikLabels";
import { HOSTNAME } from "../../constants";
import { buildHost } from "../../helpers/buildHost";

export interface Neo4jArgs {
  vaultProvider: vault.Provider;
  platformNetworkId?: docker.Network["id"];
  ingressNetworkId: docker.Network["id"];
  environment: string;
}

export class Neo4j extends pulumi.ComponentResource {
  readonly credentials: VaultCredentials;
  readonly hostname: docker.Service["name"];

  private readonly dataVolume: docker.Volume;
  private readonly pluginVolume: docker.Volume;
  private readonly service: docker.Service;

  constructor(
    name: string,
    args: Neo4jArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("SprocketBot:Services:Neo4j", name, {}, opts);

    this.credentials = new VaultCredentials(
      `${name}-root-credentials`,
      {
        username: "neo4j",
        vault: {
          path: `platform/elo/${args.environment}/neo4j`,
          provider: args.vaultProvider,
        },
        additionalVaultData: {
          connectionUrl: `${buildHost(
            "bolt",
            "neo4j",
            args.environment,
            HOSTNAME,
          )}:80`,
          webUrl: `https://${buildHost("neo4j", args.environment, HOSTNAME)}`,
        },
      },
      { parent: this },
    );

    this.dataVolume = new docker.Volume(
      `${name}-data-vol`,
      { name: `${name}-data` },
      {
        parent: this,
        retainOnDelete: true,
      },
    );
    this.pluginVolume = new docker.Volume(
      `${name}-plugin-vol`,
      { name: `${name}-plugin` },
      {
        parent: this,
        retainOnDelete: true,
      },
    );

    this.service = new docker.Service(
      `${name}-service`,
      {
        endpointSpec: {
          // ports: [{
          //     targetPort: 7687,
          //     publishedPort: 7687,
          //     publishMode: "ingress"
          // }, {
          //     targetPort: 7473,
          //     publishedPort: 7473,
          //     publishMode: "ingress"
          // }]
        },
        taskSpec: {
          containerSpec: {
            image: "neo4j:4.4.7-community",
            env: {
              NEO4J_AUTH: this.credentials.password.apply((p) => `neo4j/${p}`),
              NEO4J_clients_allow__telemetry: "false",
              // NEO4J_dbms_connector_bolt_listen__address: ":7687",
              // NEO4J_dbms_connector_bolt_tls__level: "REQUIRED",
              //
              // NEO4J_dbms_default__advertised__address: "0.0.0.0",
              NEO4J_dbms_default__listen__address: "0.0.0.0",
              NEO4J_dbms_default__advertised__address:
                "neo4j.dev.spr.ocket.cloud",
              // NEO4J_dbms_connector_https_enabled: "true"
            },
            mounts: [
              {
                type: "volume",
                target: "/data",
                source: this.dataVolume.id,
              },
              {
                type: "volume",
                target: "/plugins",
                source: this.pluginVolume.id,
              },
            ],
          },
          logDriver: DefaultLogDriver(name, true),
          placement: {
            constraints: ["node.labels.role==storage"],
          },
          networks: args.platformNetworkId
            ? [args.platformNetworkId, args.ingressNetworkId]
            : [args.ingressNetworkId],
        },
        labels: [
          ...new TraefikLabels(name)
            .tls(CertResolver.DNS)
            .rule(`Host(\`${buildHost("neo4j", args.environment, HOSTNAME)}\`)`)
            .targetPort(7474)
            .forwardAuthRule("EloTeam")
            .service(name).complete,
          ...new TraefikLabels(`${name}-bolt`, "tcp")
            .rule(
              `HostSNI(\`${buildHost(
                "bolt",
                "neo4j",
                args.environment,
                HOSTNAME,
              )}\`)`,
            )
            .targetPort(7687)
            .tls(CertResolver.DNS)
            .service(`${name}-bolt`).complete,
          ...new TraefikLabels(`${name}-bolt-http`)
            .rule(
              `Host(\`${buildHost(
                "bolt",
                "neo4j",
                args.environment,
                HOSTNAME,
              )}\`)`,
            )
            .targetPort(7687)
            .tls(CertResolver.DNS)
            .service(`${name}-bolt-http`).complete,
        ],
      },
      { parent: this },
    );
    this.hostname = this.service.name;
  }
}
