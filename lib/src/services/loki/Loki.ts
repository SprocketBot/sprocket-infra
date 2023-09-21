import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as random from "@pulumi/random";
import { buildUrn, URN_TYPE } from "../../constants/pulumi";
import { LogDriver, ServiceCategory } from "../../utils";
import { Role, RoleRestriction } from "../../constants/docker-node-labels";

export type LokiArgs = {
  monitoringNetworkId: docker.Network["id"];
};

export class Loki extends pulumi.ComponentResource {
  private readonly service: docker.Service;
  private readonly volume: docker.Volume;

  readonly url: docker.Service["name"];
  readonly hostname: docker.Service["name"];

  constructor(
    name: string,
    args: LokiArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Database, "Loki", name), name, {}, opts);
    this.volume = new docker.Volume("loki-vol", {}, { parent: this });
    this.service = new docker.Service(
      "loki-service",
      {
        name: new random.RandomPet(
          "service-name-gen",
          {},
          { parent: this },
        ).id.apply(($id) => `loki-${$id}`),
        taskSpec: {
          containerSpec: {
            image: "grafana/loki:2.9.1",
            mounts: [
              {
                type: "volume",
                source: this.volume.id,
                target: "/loki",
              },
            ],
          },
          logDriver: LogDriver("loki", ServiceCategory.MONITORING),
          networksAdvanceds: [{ name: args.monitoringNetworkId }],
          placement: {
            constraints: [RoleRestriction(Role.SECONDARY_STORAGE)],
          },
        },
      },
      { parent: this },
    );

    this.url = this.service.name.apply(($name) => `http://${$name}:3100`);
    this.hostname = this.service.name;
  }
}
