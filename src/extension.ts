import * as vscode from 'vscode';
import { MatlabWorkspaceProvider } from './workspaceProvider';
import { MatlabConnection } from './matlabConnection';

let workspaceProvider: MatlabWorkspaceProvider;
let matlabConnection: MatlabConnection;

export function activate(context: vscode.ExtensionContext) {
    console.log('MATLAB Workspace Viewer is now active');

    // Initialize MATLAB connection
    matlabConnection = new MatlabConnection();

    // Create workspace provider
    workspaceProvider = new MatlabWorkspaceProvider(matlabConnection);

    // Register tree view
    const treeView = vscode.window.createTreeView('matlabWorkspace', {
        treeDataProvider: workspaceProvider,
        showCollapseAll: true
    });

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('matlabWorkspace.refresh', () => {
            workspaceProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('matlabWorkspace.clearAll', async () => {
            const result = await vscode.window.showWarningMessage(
                'Are you sure you want to clear all MATLAB workspace variables?',
                'Yes', 'No'
            );
            if (result === 'Yes') {
                await matlabConnection.clearWorkspace();
                workspaceProvider.refresh();
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('matlabWorkspace.copyValue', async (item) => {
            if (item && item.value) {
                await vscode.env.clipboard.writeText(item.value);
                vscode.window.showInformationMessage(`Copied: ${item.value}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('matlabWorkspace.deleteVariable', async (item) => {
            if (item && item.variableName) {
                await matlabConnection.deleteVariable(item.variableName);
                workspaceProvider.refresh();
                vscode.window.showInformationMessage(`Deleted variable: ${item.variableName}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('matlabWorkspace.createHelperScript', async () => {
            await matlabConnection.createMatlabHelperScript();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('matlabWorkspace.exportNow', async () => {
            await matlabConnection.triggerWorkspaceExport();
            // Refresh the view after a short delay
            setTimeout(() => workspaceProvider.refresh(), 1000);
        })
    );

    // Set up auto-refresh if enabled
    const config = vscode.workspace.getConfiguration('matlabWorkspace');
    const refreshInterval = config.get<number>('refreshInterval', 2000);

    if (refreshInterval > 0) {
        setInterval(() => {
            workspaceProvider.refresh();
        }, refreshInterval);
    }

    // Listen for new terminals and auto-setup MATLAB terminals
    const autoSetupEnabled = config.get<boolean>('autoSetupOnTerminalOpen', true);
    if (autoSetupEnabled) {
        context.subscriptions.push(
            vscode.window.onDidOpenTerminal(async (terminal) => {
                const terminalName = terminal.name.toLowerCase();

                // Check if this is a MATLAB terminal
                if (terminalName.includes('matlab')) {
                    const shouldAutoSetup = config.get<boolean>('autoSetupOnTerminalOpen', true);

                    if (shouldAutoSetup) {
                        // Show the terminal
                        terminal.show(true);

                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                        if (!workspaceFolder) return;

                        const workspaceFile = workspaceFolder.uri.fsPath + '/.vscode/matlab_workspace.json';
                        let setupComplete = false;
                        let attemptCount = 0;
                        const maxAttempts = 10;

                        // Watch for workspace file changes to detect successful setup
                        const watcher = vscode.workspace.createFileSystemWatcher(workspaceFile);
                        const disposable = watcher.onDidChange(() => {
                            if (!setupComplete) {
                                setupComplete = true;
                                vscode.window.showInformationMessage('MATLAB Workspace Viewer: Auto-setup successful!');
                                watcher.dispose();
                                disposable.dispose();
                            }
                        });

                        // Retry sending the command with increasing delays until successful
                        const trySendSetup = () => {
                            if (setupComplete || attemptCount >= maxAttempts) {
                                watcher.dispose();
                                disposable.dispose();
                                if (!setupComplete && attemptCount >= maxAttempts) {
                                    vscode.window.showWarningMessage(
                                        'MATLAB Workspace Viewer: Auto-setup may have failed. Run "setup_auto_export" in MATLAB manually.',
                                        'Copy Command'
                                    ).then(selection => {
                                        if (selection === 'Copy Command') {
                                            vscode.env.clipboard.writeText("addpath('.vscode'); setup_auto_export");
                                        }
                                    });
                                }
                                return;
                            }

                            attemptCount++;
                            const delay = 2000 + (attemptCount * 1000); // 3s, 4s, 5s, 6s...

                            setTimeout(() => {
                                if (!setupComplete) {
                                    terminal.sendText("addpath('.vscode'); setup_auto_export");

                                    // Show notification on first attempt
                                    if (attemptCount === 1) {
                                        vscode.window.showInformationMessage(
                                            'MATLAB Workspace Viewer: Waiting for MATLAB to start...',
                                            'Disable Auto-Setup'
                                        ).then(selection => {
                                            if (selection === 'Disable Auto-Setup') {
                                                setupComplete = true; // Stop retrying
                                                config.update('autoSetupOnTerminalOpen', false, vscode.ConfigurationTarget.Global);
                                            }
                                        });
                                    }

                                    // Try again
                                    trySendSetup();
                                }
                            }, delay);
                        };

                        // Start the retry process
                        trySendSetup();

                        // Clean up after 60 seconds regardless
                        setTimeout(() => {
                            watcher.dispose();
                            disposable.dispose();
                        }, 60000);
                    }
                }
            })
        );
    }

    context.subscriptions.push(treeView);
}

export function deactivate() {
    if (matlabConnection) {
        matlabConnection.dispose();
    }
}
