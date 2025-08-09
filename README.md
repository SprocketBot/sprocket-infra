For a cohesive end-to-end deployment overview, see `DEPLOYMENT_OVERVIEW.md`.

Useful snippet for pointing to a remote docker host  
```bash
ssh -L localhost:2377:/var/run/docker.sock user@remotehost
export DOCKER_HOST=tcp://localhost:2377
```

## Signing in to Pulumi

Ensure that you have some `~/.aws/credentials` file shaped as such:

```
[default]
aws_access_key_id = [your access key]
aws_secret_access_key = [your secret key]
region = [some region (probably made up if not S3 proper)]
```


Next, you can run this to log in:

```bash
pulumi login "s3://[your bucket]/pulumi?endpoint=[your endpoint]"
```

Order of deployments for bootstrapping:
1. Core
2. Vault Policies
   - Requires `vault-token` secret configuration  
     Run `pulumi config set vault-token --secret [root token]` in `./vault-policies`   
      
