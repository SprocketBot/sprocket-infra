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
     
     ## Resetting Vault from Scratch
     
     When resetting Vault completely (e.g., after a failed initialization), follow these steps:
     
     1. **Clear S3 storage**: Delete all objects in the `vault_storage` path of your S3 bucket. The bucket name is configured in the Pulumi project (check `pulumi config get vault-s3-bucket`).
     
     2. **Remove Docker volumes**: Execute the following command to remove all Vault-related Docker volumes:
        ```bash
        docker volume rm $(docker volume ls -q | grep vault)
        ```
     
     3. **Use Node.js 16**: Ensure Node.js version 16 is active before running Pulumi commands. If using nvm, run:
        ```bash
        nvm use 16
        ```
     
     4. **Reinitialize**: Proceed with the standard deployment order (Core, then Vault Policies).
     
     Additionally, the `auto-initialize.sh` script has been updated to check for the existence of `unseal_tokens.txt` before attempting to unseal, preventing errors when the file is missing.
      