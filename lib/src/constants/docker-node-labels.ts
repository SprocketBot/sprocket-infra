import { config } from "./pulumi";

export enum Role {
  COMPUTE = "compute",
  /**
   * Node should host things like databases, there should only be one node with this label
   */
  PRIMARY_STORAGE = "primary_storage",

  /**
   * Node should host things that need more storage or memory, but are ephemeral e.g. Redis, RabbitMQ
   */
  SECONDARY_STORAGE = "secondary_storage",

  INGRESS = "ingress",
}

export const RoleRestriction = (role: Role) => {
  if (config.get<string>("disabled-role-restrictions")?.includes(role))
    return "";
  return `node.labels.role==${role}`;
};
