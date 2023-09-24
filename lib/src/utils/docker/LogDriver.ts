import * as docker from "@pulumi/docker";

export enum ServiceCategory {
  INFRASTRUCTURE = "infra",
  PLATFORM = "platform",
  MONITORING = "monitoring",
  UTILITY = "util",
  DATA_TOOL = "data_tool",
}
export const LogDriver = (
  serviceName: string,
  category: ServiceCategory,
): docker.types.input.ServiceTaskSpecLogDriver => ({
  name: "fluentd",
  options: {
    "fluentd-async": "true",
    tag: `docker.${category}.${serviceName}`,
  },
});
