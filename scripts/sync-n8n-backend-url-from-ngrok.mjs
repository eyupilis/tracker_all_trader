#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);

function getArg(name, fallback) {
    const idx = args.indexOf(name);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    return fallback;
}

const workflowPath = resolve(getArg('--workflow', 'n8n_real_workflow.json'));
const ngrokApiUrl = getArg('--ngrok-api', 'http://127.0.0.1:4040/api/tunnels');

async function getNgrokPublicUrl() {
    const res = await fetch(ngrokApiUrl);
    if (!res.ok) {
        throw new Error(`Cannot read ngrok API (${res.status} ${res.statusText}) from ${ngrokApiUrl}`);
    }

    const data = await res.json();
    const tunnels = Array.isArray(data?.tunnels) ? data.tunnels : [];
    if (tunnels.length === 0) {
        throw new Error(`No active tunnels found at ${ngrokApiUrl}`);
    }

    const httpsTunnel =
        tunnels.find((t) => t?.public_url && String(t.public_url).startsWith('https://')) || tunnels[0];
    const publicUrl = httpsTunnel?.public_url;

    if (!publicUrl || typeof publicUrl !== 'string') {
        throw new Error('Could not resolve ngrok public_url');
    }

    return publicUrl;
}

function setBackendBaseUrl(workflow, backendBaseUrl) {
    const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : null;
    if (!nodes) throw new Error('Invalid workflow JSON: nodes[] not found');

    const configNode = nodes.find((n) => n?.name === 'Workflow Configuration');
    if (!configNode) throw new Error('Workflow Configuration node not found');

    const assignments =
        configNode?.parameters?.assignments?.assignments;
    if (!Array.isArray(assignments)) {
        throw new Error('Workflow Configuration assignments not found');
    }

    const backendField = assignments.find((a) => a?.name === 'backendBaseUrl');
    if (!backendField) throw new Error('backendBaseUrl assignment not found');

    backendField.value = backendBaseUrl;
    backendField.type = 'string';
}

async function main() {
    const ngrokUrl = await getNgrokPublicUrl();
    const raw = readFileSync(workflowPath, 'utf8');
    const workflow = JSON.parse(raw);

    setBackendBaseUrl(workflow, ngrokUrl);
    writeFileSync(workflowPath, `${JSON.stringify(workflow, null, 4)}\n`, 'utf8');

    console.log(`Updated backendBaseUrl -> ${ngrokUrl}`);
    console.log(`Workflow file: ${workflowPath}`);
}

main().catch((err) => {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
});

