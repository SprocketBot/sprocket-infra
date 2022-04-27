import axios from "axios";

type DockerHubResponse = {
    count: number,
    next: string | null,
    previous: string | null,
    results: {
        namespace: string,
        repository: string,
        digest: string,
        tags: {
            tag: string,
            is_current: boolean
        }[],
        last_pushed: string,
        last_pulled: string | null,
        status: string
    }[]
}

/**
 * @param namespace {string} Dockerhub username (i.e. namespace/repository:tag)
 * @param repository {string} Image name (i.e. namespace/repository:tag)
 * @param tag {string} Image Tag (i.e. namespace/repository:tag)
 * @param username {string} Dockerhub username
 * @param pat {string} Dockerhub personal access token
 */
export async function getImageSha(namespace: string, repository: string, tag: string, username: string, pat: string) {
    const tokenResponse = await axios.post("https://hub.docker.com/v2/users/login", {
        "username": username, "password": pat
    }, {
        headers: {
            "Content-Type": "application/json"
        },
    })
    const token = tokenResponse.data.token

    const results = await axios.get<DockerHubResponse>(`https://hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}/images?currently_tagged=true`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })

    const result = results.data.results.find(r => r.tags.some(t => t.tag === tag))
    if (!result) throw new Error(`Tag not found! ${namespace}/${repository}:${tag}`)
    return `${namespace}/${repository}@${result.digest}`
}