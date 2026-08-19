// inspired by https://github.com/gleam-lang/vscode-gleam/blob/main/src/extension.ts

import * as vscode from "vscode";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
} from "vscode-languageclient/node";
import { getBuiltinFileContent } from "./lsp_ext";

const EXTENSION_NS = "par";

const enum ParCommands {
    RestartServer = `${EXTENSION_NS}.restartServer`,
}

let client: LanguageClient | undefined;
let configureLang: vscode.Disposable | undefined;

function getClient() {
    if (!client) {
        vscode.window.showErrorMessage("Par client not found");
        throw new Error("Par client not found");
    }
    return client;
}

export async function activate(context: vscode.ExtensionContext) {
    const restartCommand = vscode.commands.registerCommand(
        ParCommands.RestartServer,
        async () => {
            const client = getClient();

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

    context.subscriptions.push(
        vscode.commands.registerCommand(
            `${EXTENSION_NS}.runDefinitionCli`,
            async (uri: string, target: string) => {
                const command = await getParCommand();
                if (!command) return;

                const packageUri = vscode.Uri.parse(uri, true);
                const args = ["run", "--package", packageUri.fsPath, target];
                const task = new vscode.Task(
                    { type: "process" },
                    vscode.workspace.getWorkspaceFolder(packageUri) ??
                        vscode.TaskScope.Workspace,
                    `Par Run: ${target}`,
                    "par",
                    new vscode.ProcessExecution(command, args),
                );
                task.presentationOptions.clear = true;
                task.presentationOptions.focus = false;

                await vscode.tasks.executeTask(task);
            },
        ),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            `${EXTENSION_NS}.runTestCli`,
            async (uri: string, target: string) => {
                const command = await getParCommand();
                if (!command) return;

                const packageUri = vscode.Uri.parse(uri, true);
                const args = ["test", "--package", packageUri.fsPath, target];
                const task = new vscode.Task(
                    { type: "process" },
                    vscode.workspace.getWorkspaceFolder(packageUri) ??
                        vscode.TaskScope.Workspace,
                    `Par Test: ${target}`,
                    "par",
                    new vscode.ProcessExecution(command, args),
                );
                task.presentationOptions.clear = true;
                task.presentationOptions.focus = false;

                await vscode.tasks.executeTask(task);
            },
        ),
    );

    const tdcp: vscode.TextDocumentContentProvider = {
        provideTextDocumentContent(
            uri: vscode.Uri,
            token: vscode.CancellationToken,
        ): vscode.ProviderResult<string> {
            const client = getClient();

            return client.sendRequest(
                getBuiltinFileContent,
                { builtin_path: uri.path },
                token,
            );
        },
    };
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider("par-builtin", tdcp),
    );

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
