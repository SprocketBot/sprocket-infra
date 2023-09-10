import * as pulumi from "@pulumi/pulumi";
import * as vault from "@pulumi/vault";
import * as docker from "@pulumi/docker";
import {buildUrn, URN_TYPE} from "../../constants/pulumi";

/*

- Discord Authentication _may_ be possible with Vault
	- OIDC is used by Vault; while discord uses OAuth
		- There is a wrapper (designed for use with AWS Cognito)
		- Vault passes a `nonce` query parameter to the discord authentication page; and it seems to expect it back. Discord does not pass it through (it only passes `code`)
	- We _could_ write an entire fucking plugin for Vault, but that seems overkill
	- Nonetheless, Github PAT Authentication is starting to seem a little silly.
 */

export type VaultDiscordOidcArgs = {
    endpoint: Outputable<string>,
    discord: {
        clientId: Outputable<string>,
        secretId: Outputable<string>
    }
}

export class VaultDiscordOidc extends pulumi.ComponentResource {
    constructor(name: string, args: VaultDiscordOidcArgs, opts?: pulumi.ComponentResourceOptions) {
        super(buildUrn(URN_TYPE.Configuration, "VaultDiscordOidc"), name, {}, opts);

        const discordOidcAuth = new vault.AuthBackend("discord-oidc", {
            type: "oidc",
            path: "discord",
            description: "Discord OAuth Login",
            tune: {
                listingVisibility: "unauth"
            }
        }, {parent: this})

        const discordOidcAuthConfig = new vault.generic.Secret("discord-oidc-config", {
            path: discordOidcAuth.path.apply($path => `auth/${$path}/config`),
            dataJson:
                pulumi.all([args.discord]).apply(([$discord]) => JSON.stringify({
                        oidc_discovery_url: "https://3a1aa5d81a8e.ngrok.app",
                        oidc_client_id: $discord.clientId,
                        oidc_client_secret: $discord.secretId,
                        default_role: "no-access"
                    })
                )
        }, {parent: this, dependsOn: [discordOidcAuth], retainOnDelete: true})

        const redirectUri = pulumi.all([args.endpoint, discordOidcAuth.path]).apply(([$endpoint, $path]) => `${$endpoint}/ui/vault/auth/${$path}/oidc/callback`)

        redirectUri.apply(console.log)

        const discordOidcAuthRoles = {
            noAccess: new vault.generic.Secret("discord-oidc-config-role-no-access", {
                path: discordOidcAuth.path.apply($path => `auth/${$path}/role/no-access`),
                dataJson: redirectUri.apply($uri => JSON.stringify({
                    allowed_redirect_uris: [$uri],
                    user_claim: "sub",
                    token_policies: ["default"],
                    oidc_scopes: ["identify"],
                    verbose_oidc_logging: true
                }))
            }, {parent: this, dependsOn: [discordOidcAuth]})
        }

    }

}