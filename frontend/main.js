const { Terminal } = require("xterm");
const { AttachAddon } = require("xterm-addon-attach");
const { FitAddon } = require("xterm-addon-fit");
const copyToClipboard = require("copy-to-clipboard");

const podNameInput = document.getElementById("pod-name");
const namespaceInput = document.getElementById("namespace");
const kubeconfigInput = document.getElementById("kubeconfig");
const podAttachButton = document.getElementById("pod-attach");
const terminalComponent = document.getElementById("terminal");

const HOST = window.location.host;

let socket = null;

const podExec = (pod, kubeconfig, namespace) => {
  // If active socket is being used, close connection and remove terminal view
  if (socket !== null) {
    terminalComponent.innerHTML = "";
    socket.close();
    socket = null;
    setTimeout(() => {
      podExec(pod, kubeconfig, namespace);
    }, 1000);
    return;
  }

  const wsUrl = `ws://${HOST}/ws?pod=${pod}&kubeconfig=${kubeconfig}&namespace=${namespace || ''}`;
  socket = new WebSocket(wsUrl);

  socket.addEventListener("open", () => {
    setTimeout(() => {
      socket.send("hostname\n");
    }, 500);
  });

  const attachAddon = new AttachAddon(socket);

  const fitAddon = new FitAddon();
  term = new Terminal({
    cursorBlink: "block",
    cols: 150,
  });
  term.loadAddon(fitAddon);
  term.open(terminalComponent);
  fitAddon.fit();
  term.loadAddon(attachAddon);

  socket.addEventListener("close", (event) => {
    term.writeln("");
    term.writeln("  \u001b[31m[!] Lost connection");
  });

  document.addEventListener("keydown", (zEvent) => {
    if (zEvent.ctrlKey && zEvent.shiftKey && zEvent.key === "C") {
      zEvent.preventDefault();
      copyToClipboard(term.getSelection());
    }
  });

  window.onresize = () => {
    fitAddon.fit();
  };
};

podAttachButton.addEventListener("click", () => {
  if (podNameInput.value.length && kubeconfigInput.value.length) {
    console.log(podNameInput.value);
    podExec(podNameInput.value, btoa(kubeconfigInput.value), namespaceInput.value);
  }
});
