import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import {
  BASE_HOSTNAME,
  buildUrn,
  CertResolver,
  EntryPoint,
  URN_TYPE,
} from "../../constants";
import { TraefikHttpLabel } from "../../utils/docker";
import { Role, RoleRestriction } from "../../constants/docker-node-labels";
import { Outputable } from "../../types";

export type MageArgs = {
  ingressNetworkId: docker.Network["id"];
  githubPat: Outputable<string>;
};

export class Mage extends pulumi.ComponentResource {
    constructor(name: string, args: MageArgs, opts?: pulumi.ComponentResourceOptions) {
        super(buildUrn(URN_TYPE.Service, "mageai", name), name, {}, opts)
        
        const volume = new docker.Volume(`${name}-volume`, {}, { parent: this })
        
        const service = new docker.Service(`${name}-service`, {
            taskSpec: {
                 containerSpec: {
                     image: "mageai/mageai:latest",
                     mounts: [{
                         source: volume.id,
                         type: "volume",
                         target: "/home/src"
                     }],
                     // TODO: https://docs.mage.ai/development/variables/environment-variables
                     env: {
                         PROJECT_NAME: "SprocketData",
                         ENV: "production",
                         REQUIRE_USER_AUTHENTICATION: "1",
                         GIT_REPO_LINK: "https://github.com/sprocketbot/data",
                         GIT_REPO_PATH: "data",
                         GIT_USERNAME: "TheSprocketBot",
                         GIT_EMAIL: "admin@sprocket.gg",
                         GIT_AUTH_TYPE: "https",
                         GIT_ACCESS_TOKEN: args.githubPat,
                         GIT_SYNC_ON_EXECUTOR_START: "0",
                         GIT_SYNC_ON_START: "1",
                         GIT_SYNC_ON_PIPELINE_RUN: "1",
                         GIT_BRANCH: "main",
                         DISABLE_NOTEBOOK_EDIT_ACCESS: "1",
                         DISABLE_TERMINAL: "1",
                         HIDE_ENV_VAR_VALUES: "1"
                         // TODO: https://docs.mage.ai/production/authentication/overview#ldap
                     }
                 },
                networksAdvanceds: [{name: args.ingressNetworkId}],
                placement: {
                     constraints: [RoleRestriction(Role.INGRESS, true)]
                 },
            },
            labels: new TraefikHttpLabel(name)
            .entryPoints(EntryPoint.HTTPS)
            .targetPort(6789)
            .rule(`Host(\`mage.${BASE_HOSTNAME}\`)`)
            .tls(CertResolver.DNS)
            .complete
        }, { parent: this })
    }
}