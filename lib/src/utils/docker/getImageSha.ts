import * as pulumi from "@pulumi/pulumi";
import fetch from "node-fetch";
import { Outputable } from "../../types";

const config = new pulumi.Config();

type DockerHubResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: {
    namespace: string;
    repository: string;
    digest: string;
    tags: {
      tag: string;
      is_current: boolean;
    }[];
    last_pushed: string;
    last_pulled: string | null;
    status: string;
  }[];
};

/**
 * @param namespace {string} Dockerhub username (i.e. namespace/repository:tag)
 * @param repository {string} Image name (i.e. namespace/repository:tag)
 * @param tag {string} Image Tag (i.e. namespace/repository:tag)
 */
export function getImageSha(
  namespace: string,
  repository: string,
  tag: string,
  auth?: Outputable<{ username: string; password: string }>,
): pulumi.Output<string> {
  return pulumi
    .all(
      auth
        ? [auth.username, auth.password]
        : [
            config.require("docker-username"),
            config.requireSecret("docker-access-token"),
          ],
    )
    .apply(async ([username, pat]) => {
      const tokenResponse = await fetch(
        "https://hub.docker.com/v2/users/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username, password: pat }),
        },
      ).catch((e) => {
        console.log(`Failed to look up ${namespace}/${repository}:${tag}`);
        throw e;
      });

      const tokenData = await tokenResponse.json();
      const token = tokenData.token;

      const resultsResponse = await fetch(
        `https://hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}/images?currently_tagged=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      ).catch((e) => {
        console.log(`Failed to look up ${namespace}/${repository}:${tag}`);
        throw e;
      });

      const resultsData: DockerHubResponse = await resultsResponse.json();

      const result = resultsData.results.find((r) =>
        r.tags.some((t) => t.tag === tag),
      );

      if (!result)
        throw new Error(`Tag not found! ${namespace}/${repository}:${tag}`);
      console.log(`${namespace}/${repository}@${result.digest} (${tag})`);
      return `${namespace}/${repository}@${result.digest}`;
    });
}
