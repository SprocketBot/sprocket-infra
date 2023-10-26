import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";
import {buildUrn, URN_TYPE} from "../../constants";

export type VaultLdapArgs = {}


export class VaultLdap extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: VaultLdapArgs,
        opts?: pulumi.ComponentResourceOptions,
        ) {
        super(buildUrn(URN_TYPE.LogicalGroup, "VaultLdap"), name, {}, opts);
        
        new vault.ldap.AuthBackend("rp-ldap", {
            description: "RolyPoly authentication",
            binddn: "cn=admin,dc=rolypoly,dc=sh",
            bindpass: "admin",
            url: "ldap://rolypoly-ldap:389",
            userdn: "ou=Users,dc=rolypoly,dc=sh",
            userfilter: "(cn={{.Username}})",
            groupdn: "ou=Roles,dc=rolypoly,dc=sh",
            groupfilter: "(member={{.UserDN}})",
            groupattr: "cn",
            usernameAsAlias: true,
            caseSensitiveNames: false
        }, { parent: this, deleteBeforeReplace: true })
        
        const maintainersPolicy = new vault.Policy("maintainers-policy", {
            name: "pulumi-maintainers",
            policy: `
# Full access to kv and database secret engines
path "kv2/*" { capabilities = ["create", "read", "update", "delete", "list"] }
path "database/*" { capabilities = ["create", "read", "update", "delete", "list"] }

# Except sudo creds
path "kv2/sudo/*" { capabilities = ["deny"] }
            
# Read ACL Policies
path "sys/policies/acl/pulumi-*" { capabilities = [ "read", "list" ] }
            `
        }, { parent: this })
        
        new vault.ldap.AuthBackendGroup("maintainers", {
            groupname: "Maintainers - Sprocket Community",
            policies: [maintainersPolicy.name]
        }, { parent: this })
        
    }
}