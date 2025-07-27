// inspired by https://github.com/gleam-lang/vscode-gleam/blob/main/src/extension.ts

import * as vscode from "vscode";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
} from "vscode-languageclient/node";

const EXTENSION_NS = "par";

const enum ParCommands {
    RestartServer = `${EXTENSION_NS}.restartServer`,
}

let client: LanguageClient | undefined;
let configureLang: vscode.Disposable | undefined;

export async function activate(context: vscode.ExtensionContext) {
    const restartCommand = vscode.commands.registerCommand(
        ParCommands.RestartServer,
        async () => {
            if (!client) {
                vscode.window.showErrorMessage("Par client not found");
                return;
            }
            try {
                if (client.isRunning()) {
                    await client.restart();
                    vscode.window.showInformationMessage("Par server restarted.");
                } else {
                    await client.start();
                }
            } catch (err) {
                client.error("Restarting Par client failed", err, "force");
            }
        },
    );
    context.subscriptions.push(restartCommand);

    client = await createLanguageClient();
    client?.start();
}

export function deactivate(): Thenable<void> | undefined {
    configureLang?.dispose();

    return client?.stop();
}

async function createLanguageClient(): Promise<LanguageClient | undefined> {
    const command = await getParCommand();
    if (!command) {
        const message = `Could not resolve Par executable. Please ensure it is available
    on the PATH used by VS Code or set an explicit "${EXTENSION_NS}.path" setting to a valid Par executable.`;

        vscode.window.showErrorMessage(message);
        return;
    }

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: "file", language: "par" }],
        traceOutputChannel: vscode.window.createOutputChannel("Par LSP Trace"),
    };

    const serverOptions: ServerOptions = {
        command,
        args: ["lsp"],
    };

    return new LanguageClient(
        "par",
        "Par Language Server",
        serverOptions,
        clientOptions,
    );
}

export async function getParCommand(): Promise<string | undefined> {
    const command = getParCommandFromConfig();
    // todo: what if it's unset
    return command;
}

function getParCommandFromConfig(): string | undefined {
    const parPath = vscode.workspace.getConfiguration(EXTENSION_NS).get("path");
    if (typeof parPath !== "string" || parPath.trim().length === 0) {
        return undefined;
    } else {
        return parPath;
    }
}
