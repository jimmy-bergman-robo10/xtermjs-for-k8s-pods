const fs = require('fs');
const yaml = require('js-yaml');
const WebSocket = require('ws');

exports.connect = (pod, kubeconfigContent, podNamespace) => {
  const kubeconfig = yaml.load(kubeconfigContent);

  // Get the current context
  const currentContextName = kubeconfig['current-context'];
  const currentContext = kubeconfig.contexts.find(
    (context) => context.name === currentContextName
  );

  if (!currentContext) {
    throw new Error(`Context ${currentContextName} not found in kubeconfig`);
  }

  // Get the cluster and user names from the current context
  const clusterName = currentContext.context.cluster;
  const userName = currentContext.context.user;

  // Find the cluster and user entries
  const cluster = kubeconfig.clusters.find((c) => c.name === clusterName);
  const user = kubeconfig.users.find((u) => u.name === userName);

  if (!cluster) {
    throw new Error(`Cluster ${clusterName} not found in kubeconfig`);
  }
  if (!user) {
    throw new Error(`User ${userName} not found in kubeconfig`);
  }

  // Extract the cluster server URL and CA certificate
  const server = cluster.cluster.server;
  let caCert;
  if (cluster.cluster['certificate-authority-data']) {
    // CA certificate is provided as base64-encoded data
    caCert = Buffer.from(
      cluster.cluster['certificate-authority-data'],
      'base64'
    );
  } else if (cluster.cluster['certificate-authority']) {
    // CA certificate is provided as a file path
    caCert = fs.readFileSync(cluster.cluster['certificate-authority']);
  }

  // Extract client certificate and key
  let clientCert;
  if (user.user['client-certificate-data']) {
    clientCert = Buffer.from(user.user['client-certificate-data'], 'base64');
  } else if (user.user['client-certificate']) {
    clientCert = fs.readFileSync(user.user['client-certificate']);
  }

  let clientKey;
  if (user.user['client-key-data']) {
    clientKey = Buffer.from(user.user['client-key-data'], 'base64');
  } else if (user.user['client-key']) {
    clientKey = fs.readFileSync(user.user['client-key']);
  }

  // Extract bearer token if available
  let bearerToken;
  if (user.user.token) {
    bearerToken = user.user.token;
  } else if (user.user['auth-provider'] && user.user['auth-provider'].config) {
    // Handle auth-provider tokens (e.g., GCP)
    bearerToken = user.user['auth-provider'].config['access-token'];
  }

  // Construct the WebSocket URL
  const namespace = podNamespace || currentContext.context.namespace || 'default';
  const podUrl = `${server}/api/v1/namespaces/${namespace}/pods/${pod}/exec?command=sh&stdin=true&stdout=true&tty=true`;

  // WebSocket options
  const wsOptions = {
    protocol: 'v4.channel.k8s.io',
    rejectUnauthorized: true, // Ensure TLS verification is enabled
  };

  // Add TLS certificates if available
  if (caCert) wsOptions.ca = caCert;
  if (clientCert) wsOptions.cert = clientCert;
  if (clientKey) wsOptions.key = clientKey;

  // Add authorization header if using a bearer token
  if (bearerToken) {
    wsOptions.headers = {
      Authorization: `Bearer ${bearerToken}`,
    };
  }

  // Establish the WebSocket connection
  return new WebSocket(podUrl, wsOptions);
};

exports.stdin = (characters) => {
  return Buffer.from(`\x00${characters}`, 'utf8');
};
