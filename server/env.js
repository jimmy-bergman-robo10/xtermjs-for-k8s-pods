require("dotenv").config();
const { env } = process;

exports.PORT = parseInt(env.PORT || "3000", 10);
exports.KUBERNETES_NAMESPACE = env.KUBERNETES_NAMESPACE;
