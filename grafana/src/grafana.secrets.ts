import * as vault from "@pulumi/vault";
import { z } from "zod";
import {
  VaultConstants,
  getVaultProvider,
  GrafanaConfigVars,
} from "@sprocketbot/infra-lib";

const vaultProvider = getVaultProvider();

const discordOauthSchema = z.object(
  {
    client_id: z.string({ description: "Discord OAuth ClientID" }).nonempty(),
    client_secret: z
      .string({ description: "Discord OAuth Client Secret" })
      .nonempty(),
    auth_url: z
      .string({ description: "Discord OAuth Authorization URL" })
      .nonempty()
      .url(),
    guild_id: z
      .string({ description: "Discord OAuth Guild Id (Server Id)" })
      .nonempty(),
  },
  { description: "Discord OAuth Credentials for Grafana" },
);

export const discordOauthSecret = vault.kv
  .getSecretV2Output(
    {
      mount: VaultConstants.Backend.kv2,
      name: "maintainer/manual/discord-oauth",
    },
    { provider: vaultProvider },
  )
  .data.apply(($secretData): GrafanaConfigVars["discord_oauth"] => {
    try {
      return discordOauthSchema.parse(
        $secretData,
      ) as GrafanaConfigVars["discord_oauth"];
    } catch (e) {
      if (e instanceof z.ZodError) {
        console.error(e.flatten());
        throw new Error("Discord OAuth Credentials are malformed in Vault");
      }
      throw e;
    }
  }) as GrafanaConfigVars["discord_oauth"];

const githubOauthSchema = z.object(
  {
    client_id: z.string({ description: "Github OAuth ClientID" }).nonempty(),
    client_secret: z
      .string({ description: "GitHub OAuth Client Secret" })
      .nonempty(),
  },
  { description: "GitHub OAuth Credentials for Grafana" },
);

export const githubOauthSecret = vault.kv
  .getSecretV2Output(
    {
      mount: VaultConstants.Backend.kv2,
      name: "maintainer/manual/github-oauth",
    },
    { provider: vaultProvider },
  )
  .data.apply(($secretData): GrafanaConfigVars["github_oauth"] => {
    try {
      return githubOauthSchema.parse(
        $secretData,
      ) as GrafanaConfigVars["github_oauth"];
    } catch (e) {
      if (e instanceof z.ZodError) {
        console.error(e.flatten());
        throw new Error("GitHub OAuth Credentials are malformed in Vault");
      }
      throw e;
    }
  }) as GrafanaConfigVars["github_oauth"];

const smtpSchema = z.object(
  {
    host: z.string({ description: "SMTP Server Hostname" }).nonempty(),
    from: z.string({ description: "SMTP Sender Address" }).nonempty(),
    name: z.string({ description: "SMTP Sender Name" }).nonempty(),
    password: z.string({ description: "SMTP Auth Password" }).nonempty(),
    username: z.string({ description: "SMTP Auth Username" }),
  },
  { description: "SMTP Credentials for Grafana" },
);

export const smtpSecret = vault.kv
  .getSecretV2Output(
    { mount: VaultConstants.Backend.kv2, name: "maintainer/manual/smtp" },
    { provider: vaultProvider },
  )
  .data.apply(($secretData): GrafanaConfigVars["smtp"] => {
    try {
      return smtpSchema.parse($secretData) as GrafanaConfigVars["smtp"];
    } catch (e) {
      if (e instanceof z.ZodError) {
        console.error(e.flatten());
        throw new Error("SMTP Credentials are malformed in Vault");
      }
      throw e;
    }
  }) as GrafanaConfigVars["smtp"];
