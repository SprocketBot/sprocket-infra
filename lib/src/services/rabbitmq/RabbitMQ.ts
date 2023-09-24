import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import { BASE_HOSTNAME, buildUrn, URN_TYPE } from "../../constants";
import { TraefikHttpLabel, TraefikTcpLabel } from "../../utils";

type ExposedRabbitMqArgs = {
  exposeManagement: true;
  ingressNetworkId: docker.Network["id"];
};

export type RabbitMqArgs = {
  platformNetworkId: docker.Network["id"];
} & ({ exposeManagement?: false } | ExposedRabbitMqArgs);

export class RabbitMq extends pulumi.ComponentResource {
  readonly service: docker.Service;

  constructor(
    name: string,
    args: RabbitMqArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Service, "RabbitMq"), name, {}, opts);
    this.service = new docker.Service(
      `${name}-service-${pulumi.getStack()}`,
      {
        taskSpec: {
          containerSpec: {
            image: args.exposeManagement
              ? "rabbitmq:3.12.6-management@sha256:ddbc05b3c376fbdfa1e0fd945231181c9afb0ba7b872ba43a09f1aef2c6915d4"
              : "rabbitmq:3.12.6-alpine",
            hostname: "{{.Node.Hostname}}",
          },
          networksAdvanceds: [
            {
              name: args.platformNetworkId,
            },
            args.exposeManagement ? { name: args.ingressNetworkId } : null,
          ].filter(Boolean) as docker.types.input.ContainerNetworksAdvanced[],
        },
        labels: [
          ...new TraefikTcpLabel(`${name}-rmq`)
            .rule(`HostSNI(\`rmq.${BASE_HOSTNAME}\`)`)
            .tls("lets-encrypt-tls")
            .targetPort(5672).complete,
          ...(args.exposeManagement
            ? new TraefikHttpLabel(`${name}-rmq-management`)
                .rule(`Host(\`management.rmq.${BASE_HOSTNAME}\`)`)
                .tls("lets-encrypt-tls")
                .targetPort(15672).complete
            : []),
        ],
      },
      { parent: this },
    );
  }
}
