import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import { buildUrn, config, URN_TYPE } from "../../constants";
import { LogDriver, ServiceCategory } from "../../utils";
import { Role, RoleRestriction } from "../../constants/docker-node-labels";

export type RolyPolyArgs = {
  ingressNetworkId: docker.Network["id"];
};
export class RolyPoly extends pulumi.ComponentResource {
  private readonly ldap: docker.Service;
  private readonly discordBot: docker.Service;

  constructor(
    name: string,
    args: RolyPolyArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(buildUrn(URN_TYPE.Utility, "RolyPoly", name), name, {}, opts);

    const ldapVol = new docker.Volume("ldap-volume", {}, { parent: this });
    const slapdVol = new docker.Volume("slapd-volume", {}, { parent: this });

    this.ldap = new docker.Service(
      `${name}-ldap`,
      {
        // There can only be one!
        name: "rolypoly-ldap",
        taskSpec: {
          containerSpec: {
            image: "ghcr.io/sprocketbot/rolypoly-ldap@sha256:deb413b8d534c3a75da174e49c96a658138043845aeb3c283dde529b95776c0a",
            env: {
              LDAP_ORGANIZATION: "RolyPoly",
              LDAP_DOMAIN: "rolypoly.sh",
              LDAP_REMOVE_CONFIG_AFTER_SETUP: "false",
              DISABLE_CHOWN: "true",
              LDAP_TLS: "false",
            },
            args: ["-l", "trace"],
            mounts: [
              {
                type: "volume",
                source: ldapVol.id,
                target: "/var/lib/ldap",
              },
              {
                type: "volume",
                source: slapdVol.id,
                target: "/etc/ldap/slapd.d",
              },
            ],
          },
          networksAdvanceds: [{ name: args.ingressNetworkId }],
          placement: {
            constraints: [RoleRestriction(Role.SECONDARY_STORAGE)],
          },
          logDriver: LogDriver("rolypoly-ldap", ServiceCategory.INFRASTRUCTURE),
        },
      },
      { parent: this },
    );

    this.discordBot = new docker.Service(
      `${name}-bot`,
      {
        taskSpec: {
          containerSpec: {
            image:
              "ghcr.io/sprocketbot/rolypoly@sha256:3ea1c566c741f229aabeae8664720980ca7c77864280cfbbcb7bb89ee0891268",
            commands: ["bun", "run", "/app/src/index.ts"],
            env: {
              LDAP_URL: this.ldap.name.apply(($name) => `ldap://${$name}:389`),
              LDAP_BIND_DN: "cn=admin,dc=rolypoly,dc=sh",
              LDAP_BIND_PW: "admin",
              DISCORD_TOKEN: config.requireSecret("rolypoly-token"),
              LOG_LEVEL: "debug",
            },
          },
          networksAdvanceds: [{ name: args.ingressNetworkId }],
          placement: {
            constraints: [RoleRestriction(Role.INGRESS)],
          },
          logDriver: LogDriver("rolypoly", ServiceCategory.INFRASTRUCTURE),
        },
      },
      { parent: this },
    );
  }
}
