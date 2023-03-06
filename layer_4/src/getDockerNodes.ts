import * as command from "@pulumi/command"
import * as pulumi from "@pulumi/pulumi"
import * as docker from "@pulumi/docker"
const GET_NODE_NAME_ID_CMD = 'docker node ls --format "{{.ID}} {{.Hostname}}"';

export function getDockerNodes(): pulumi.Output<{ hostname: pulumi.Output<string>, ip: pulumi.Output<string> }[]> {
  const getNodeName = new command.local.Command("docker-nodes", {
    create: GET_NODE_NAME_ID_CMD,
    update: GET_NODE_NAME_ID_CMD,
    archivePaths: ["./docker_nodes"],
    environment: {
      DOCKER_HOST: docker.config.host
    }
  })

  return getNodeName.stdout.apply(output => {
    const pairs = output.split("\n").map(o => o.split(" ")).map(([id, hostname]) => ({id, hostname}))

    return pairs.map(p => {
      const GET_NODE_ADDR_CMD = `docker node inspect ${p.id} --format "{{.Status.Addr}}"`;
      const getNodeIp = new command.local.Command(`${p.hostname}-docker-ip`, {
        create: GET_NODE_ADDR_CMD,
        update: GET_NODE_ADDR_CMD
      })

      return getNodeIp.stdout.apply(ip => ({
        ip: ip, hostname: p.hostname
      }))
    })
  })
}
