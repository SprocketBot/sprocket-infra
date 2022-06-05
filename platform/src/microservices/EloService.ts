import * as pulumi from "@pulumi/pulumi"
import * as vault from "@pulumi/vault"
import * as docker from "@pulumi/docker"
import {SprocketService, SprocketServiceArgs} from "./SprocketService";
import {Neo4j} from "global/services";

type EloServiceArgs = SprocketServiceArgs & { vault: vault.Provider, ingressNetworkId: docker.Network["id"] }

export class EloService extends pulumi.ComponentResource {
    readonly neo4j: Neo4j;
    // readonly service: SprocketService;
    private readonly neo4jSecret: docker.Secret


    constructor(name: string, args: EloServiceArgs, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:Application:Microservice:Elo", name, {});

        this.neo4j = new Neo4j(`${name}-neo4j`, {
            vaultProvider: args.vault,
            platformNetworkId: args.platformNetworkId,
            ingressNetworkId: args.ingressNetworkId,
            environment: pulumi.getStack()
        }, {parent: this})
        this.neo4jSecret = new docker.Secret(`${name}-secret`, {
            name: `${name}-creds`,
            data: this.neo4j.credentials.password.apply(v => btoa(v))
        }, {parent: this})
        // this.service = new SprocketService(`${name}-sprocketservice`, args, {parent: this})
    }

}
