# Vault Integration for MCP Credential Management

## Overview

This guide documents the HashiCorp Vault integration for MCP Gateway credential management using the Secrets Store CSI Driver. This approach provides secure, centralized credential management with minimal changes to the existing codebase.

## Architecture

```
┌──────────────┐     ┌─────────────────┐     ┌──────────┐
│  Vault       │────▶│  CSI Driver     │────▶│  Broker  │
│  (Secrets)   │     │  (Volume Mount) │     │  Pod     │
└──────────────┘     └─────────────────┘     └──────────┘
       ▲                      │                     │
       │                      ▼                     ▼
       │              SecretProviderClass    /etc/mcp-credentials/
       │                                         (mounted)
       │
   Kubernetes Auth
   (Service Account)
```

## Why CSI Driver + Vault?

### Advantages Over Traditional Approaches

1. **Zero Code Changes**: Broker/controller continue reading from `/etc/mcp-credentials/`
2. **No Sync Delays**: Direct mount on pod creation (vs 60-120s ConfigMap/Secret sync)
3. **Native Kubernetes**: Uses standard CSI volume mounts
4. **Automatic Rotation**: Built-in secret rotation based on TTL
5. **Audit Trail**: Complete audit logging in Vault
6. **Dynamic Secrets**: Support for dynamic credential generation

## Quick Start

### Prerequisites
- Kind cluster or Kubernetes cluster
- Helm installed
- kubectl configured

### Installation

```bash
# 1. Install Vault in dev mode
make vault-install

# 2. Configure Vault with example MCP credentials
make vault-configure-mcp

# 3. Install Secrets Store CSI Driver
make csi-driver-install

# 4. Configure CSI driver for MCP
make csi-configure-mcp

# 5. Test the integration
make csi-test
```

## Configuration

### SecretProviderClass

The `SecretProviderClass` defines which Vault secrets to mount:

```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: mcp-vault-credentials
  namespace: mcp-system
spec:
  provider: vault
  parameters:
    roleName: "mcp-controller"
    vaultAddress: "http://vault.vault-system.svc.cluster.local:8200"
    objects: |
      - objectName: "github-token"
        secretPath: "mcp/data/github"
        secretKey: "token"
      - objectName: "slack-token"
        secretPath: "mcp/data/slack"
        secretKey: "token"
  # Optional: Sync to K8s Secret for env vars
  secretObjects:
  - secretName: mcp-aggregated-credentials-csi
    type: Opaque
    data:
    - objectName: github-token
      key: KAGENTAI_GITHUB_CRED
```

### Pod Volume Configuration

Update pod specs to use CSI volumes:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: mcp-broker
spec:
  serviceAccountName: mcp-controller
  containers:
  - name: broker
    volumeMounts:
    - name: credentials
      mountPath: /etc/mcp-credentials
      readOnly: true
  volumes:
  - name: credentials
    csi:
      driver: secrets-store.csi.k8s.io
      readOnly: true
      volumeAttributes:
        secretProviderClass: mcp-vault-credentials
```

## Managing Credentials

### Adding New Credentials

```bash
# Add a new MCP server credential to Vault
kubectl exec -n vault-system vault-0 -- vault kv put mcp/new-server \
  token="Bearer new-token-value" \
  description="New MCP Server Token"
```

### Updating Credentials

```bash
# Update existing credential
kubectl exec -n vault-system vault-0 -- vault kv put mcp/github \
  token="Bearer ghp_NEW_TOKEN" \
  description="Updated GitHub token"
```

### Viewing Credentials

```bash
# List all MCP credentials
kubectl exec -n vault-system vault-0 -- vault kv list mcp

# View specific credential
kubectl exec -n vault-system vault-0 -- vault kv get mcp/github
```

## Migration Path

### From ConfigMap/Secret to Vault

1. **Deploy Infrastructure**
   - Install Vault and CSI driver
   - Configure Kubernetes authentication

2. **Migrate Secrets**
   - Copy existing secrets to Vault
   - Create SecretProviderClass for each use case

3. **Update Deployments**
   - Replace Secret volumes with CSI volumes
   - No changes to container code needed

4. **Verify**
   - Test credential access
   - Monitor for issues

5. **Cleanup**
   - Remove old Secrets/ConfigMaps
   - Update documentation

## Production Considerations

### High Availability

```bash
# Install Vault in HA mode with Raft
make vault-install-prod
```

### Security Hardening

1. **Enable TLS**: Use TLS for Vault communication
2. **Audit Logging**: Enable audit logs for all secret access
3. **Namespace Isolation**: Use separate Vault namespaces per environment
4. **RBAC**: Implement fine-grained access policies
5. **Auto-unseal**: Configure cloud KMS for auto-unsealing

### Secret Rotation

Configure automatic rotation in SecretProviderClass:

```yaml
spec:
  parameters:
    vaultAddress: "https://vault.prod:8200"
    roleName: "mcp-controller"
    objects: |
      - objectName: "api-key"
        secretPath: "mcp/data/server"
        secretKey: "token"
        method: "GET"
        # Rotation settings
        ttl: "1h"
        audience: "mcp-gateway"
```

### Monitoring

- Monitor CSI driver health: `kubectl get pods -n kube-system -l app=csi-secrets-store`
- Check Vault metrics: Access Vault UI at `/ui/vault/metrics`
- Set up alerts for:
  - CSI driver pod restarts
  - Vault seal status
  - Failed authentication attempts
  - Secret access patterns

## Troubleshooting

### Common Issues

#### CSI Volume Mount Fails
```bash
# Check CSI driver logs
kubectl logs -n kube-system -l app=csi-secrets-store

# Verify SecretProviderClass exists
kubectl get secretproviderclass -n mcp-system
```

#### Vault Authentication Errors
```bash
# Test Kubernetes auth
kubectl exec -n vault-system vault-0 -- vault write auth/kubernetes/login \
  role=mcp-controller \
  jwt=$(kubectl create token mcp-controller -n mcp-system)
```

#### No Secrets Mounted
```bash
# Check pod events
kubectl describe pod <pod-name> -n mcp-system

# Verify Vault path exists
kubectl exec -n vault-system vault-0 -- vault kv get mcp/test-api-key
```

## Available Make Targets

### Vault Management
- `make vault-install` - Install Vault in dev mode
- `make vault-configure-mcp` - Configure Vault with MCP credentials
- `make vault-status` - Check Vault status
- `make vault-forward` - Access Vault UI (localhost:8200)
- `make vault-uninstall` - Remove Vault

### CSI Driver Management
- `make csi-driver-install` - Install CSI driver with Vault provider
- `make csi-configure-mcp` - Create SecretProviderClass
- `make csi-patch-broker` - Update broker to use CSI volumes
- `make csi-test` - Test the integration
- `make csi-status` - Check CSI driver status
- `make csi-uninstall` - Remove CSI driver

## Next Steps

1. **Test with Real MCP Servers**: Replace example credentials with actual tokens
2. **Implement Per-Server Classes**: Create SecretProviderClass per MCPServer
3. **Add E2E Tests**: Automated testing of credential flow
4. **Production Deployment**: Move from dev to production Vault setup
5. **Documentation**: Update user guides and runbooks

## References

- [Secrets Store CSI Driver Documentation](https://secrets-store-csi-driver.sigs.k8s.io/)
- [Vault CSI Provider](https://developer.hashicorp.com/vault/docs/platform/k8s/csi)
- [Vault Kubernetes Auth](https://developer.hashicorp.com/vault/docs/auth/kubernetes)
- [Issue #140: Vault Integration](https://github.com/kagenti/mcp-gateway/issues/140)