import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface MatlabVariable {
    name: string;
    size: string;
    class: string;
    value?: any;
}

export class MatlabConnection {
    private outputChannel: vscode.OutputChannel;
    private workspaceFile: string | null = null;
    private fileWatcher: vscode.FileSystemWatcher | null = null;
    private isInitialized = false;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('MATLAB Workspace');
        this.initialize();
    }

    private async initialize() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const vscodePath = path.join(workspaceFolder.uri.fsPath, '.vscode');
        this.workspaceFile = path.join(vscodePath, 'matlab_workspace.json');

        // Create .vscode directory if it doesn't exist
        if (!fs.existsSync(vscodePath)) {
            fs.mkdirSync(vscodePath, { recursive: true });
        }

        // Clear the workspace file on startup to avoid showing stale data
        // This ensures we start with a clean slate when opening VSCode
        if (fs.existsSync(this.workspaceFile)) {
            try {
                fs.writeFileSync(this.workspaceFile, JSON.stringify({ variables: [], timestamp: new Date().toISOString() }));
                this.outputChannel.appendLine('Cleared stale workspace data');
            } catch (error) {
                this.outputChannel.appendLine(`Failed to clear workspace file: ${error}`);
            }
        }

        // Create the helper script
        await this.createMatlabHelperScript();

        // Set up file watcher for automatic updates
        this.setupFileWatcher();

        this.isInitialized = true;
    }

    /**
     * Set up file watcher to automatically refresh when MATLAB updates the workspace file
     */
    private setupFileWatcher() {
        if (!this.workspaceFile) return;

        this.fileWatcher = vscode.workspace.createFileSystemWatcher(this.workspaceFile);

        this.fileWatcher.onDidChange(() => {
            this.outputChannel.appendLine('Workspace file updated');
        });

        this.fileWatcher.onDidCreate(() => {
            this.outputChannel.appendLine('Workspace file created');
        });
    }

    /**
     * Get all variables in the MATLAB workspace by reading the exported JSON file
     */
    async getWorkspaceVariables(): Promise<MatlabVariable[]> {
        if (!this.workspaceFile) {
            this.outputChannel.appendLine('No workspace file configured');
            return [];
        }

        try {
            // Check if file exists
            if (!fs.existsSync(this.workspaceFile)) {
                this.outputChannel.appendLine(`Workspace file does not exist: ${this.workspaceFile}`);
                return [];
            }

            // Read and parse the JSON file
            const content = fs.readFileSync(this.workspaceFile, 'utf8');
            const data = JSON.parse(content);

            const variables = data.variables || [];
            this.outputChannel.appendLine(`Loaded ${variables.length} variables from workspace`);

            return variables;
        } catch (error) {
            this.outputChannel.appendLine(`Error reading workspace: ${error}`);
            return [];
        }
    }

    /**
     * Send a command to MATLAB terminal to export workspace
     * This requires the user to have MATLAB running in the VSCode terminal
     */
    async triggerWorkspaceExport(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        // Try to find an active MATLAB terminal
        const terminals = vscode.window.terminals;
        let matlabTerminal = terminals.find(t => t.name.toLowerCase().includes('matlab'));

        if (!matlabTerminal) {
            // Show instructions if no MATLAB terminal found
            const result = await vscode.window.showInformationMessage(
                'No MATLAB terminal found. Please run MATLAB in the VSCode terminal first.',
                'Show Instructions'
            );

            if (result === 'Show Instructions') {
                this.showSetupInstructions();
            }
            return;
        }

        // Send command to export workspace
        const exportCommand = `addpath('.vscode'); export_workspace();`;
        matlabTerminal.sendText(exportCommand);
        matlabTerminal.show(true);

        vscode.window.showInformationMessage('Workspace export command sent to MATLAB');
    }

    /**
     * Clear all variables in the MATLAB workspace
     */
    async clearWorkspace(): Promise<void> {
        const terminals = vscode.window.terminals;
        const matlabTerminal = terminals.find(t => t.name.toLowerCase().includes('matlab'));

        if (!matlabTerminal) {
            vscode.window.showErrorMessage('No MATLAB terminal found');
            return;
        }

        matlabTerminal.sendText('clear all');

        // Wait a bit and then trigger export
        setTimeout(() => {
            this.triggerWorkspaceExport();
        }, 500);
    }

    /**
     * Delete a specific variable from the MATLAB workspace
     */
    async deleteVariable(variableName: string): Promise<void> {
        const terminals = vscode.window.terminals;
        const matlabTerminal = terminals.find(t => t.name.toLowerCase().includes('matlab'));

        if (!matlabTerminal) {
            vscode.window.showErrorMessage('No MATLAB terminal found');
            return;
        }

        matlabTerminal.sendText(`clear ${variableName}`);

        // Wait a bit and then trigger export
        setTimeout(() => {
            this.triggerWorkspaceExport();
        }, 500);
    }

    /**
     * Create the MATLAB helper script that exports workspace to JSON
     */
    async createMatlabHelperScript(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const vscodePath = path.join(workspaceFolder.uri.fsPath, '.vscode');
        const scriptPath = path.join(vscodePath, 'export_workspace.m');

        // Don't overwrite if it already exists
        if (fs.existsSync(scriptPath)) {
            return;
        }

        const scriptContent = `function export_workspace()
    % Export MATLAB workspace variables to JSON for VSCode extension
    % This function is automatically called to update the workspace view

    vars = evalin('base', 'whos');
    varData = struct([]);

    for i = 1:length(vars)
        varData(i).name = vars(i).name;
        varData(i).size = mat2str(vars(i).size);

        % Get the actual value to check if it's complex
        try
            val = evalin('base', vars(i).name);

            % Override class for complex numbers
            if isnumeric(val) && ~isreal(val)
                varData(i).class = 'complex';
            else
                varData(i).class = vars(i).class;
            end

            if isnumeric(val) || islogical(val)
                if numel(val) <= 10
                    varData(i).value = mat2str(val);
                else
                    varData(i).value = sprintf('%s [%d elements]', class(val), numel(val));
                end
            elseif ischar(val) || isstring(val)
                if length(val) <= 100
                    varData(i).value = char(val);
                else
                    varData(i).value = [char(val(1:100)), '...'];
                end
            elseif iscell(val)
                varData(i).value = sprintf('cell array [%s]', mat2str(size(val)));
            elseif isstruct(val)
                fields = fieldnames(val);
                if ~isempty(fields)
                    varData(i).value = sprintf('struct with fields: %s', strjoin(fields, ', '));
                else
                    varData(i).value = 'struct (empty)';
                end
            elseif istable(val)
                varData(i).value = sprintf('table: %dx%d', size(val, 1), size(val, 2));
            else
                varData(i).value = sprintf('<%s>', class(val));
            end
        catch
            varData(i).value = '<error reading value>';
        end
    end

    % Convert struct array to cell array to force JSON array output
    if isempty(varData)
        output.variables = [];
    else
        varCell = cell(length(varData), 1);
        for i = 1:length(varData)
            varCell{i} = varData(i);
        end
        output.variables = varCell;
    end
    output.timestamp = char(datetime('now'));

    jsonStr = jsonencode(output);

    outputFile = fullfile(pwd, '.vscode', 'matlab_workspace.json');

    % Create directory if it doesn't exist
    if ~exist(fullfile(pwd, '.vscode'), 'dir')
        mkdir(fullfile(pwd, '.vscode'));
    end

    fid = fopen(outputFile, 'w');
    if fid == -1
        error('Could not open file for writing: %s', outputFile);
    end
    fprintf(fid, '%s', jsonStr);
    fclose(fid);

    fprintf('Workspace exported: %d variables\\n', length(vars));
end
`;

        fs.writeFileSync(scriptPath, scriptContent, 'utf8');
        this.outputChannel.appendLine(`Created helper script: ${scriptPath}`);
    }

    /**
     * Show setup instructions to the user
     */
    private showSetupInstructions() {
        const message = `
# MATLAB Workspace Viewer Setup

To use this extension:

1. Open a terminal in VSCode (Terminal → New Terminal)
2. Start MATLAB by typing: matlab -nodesktop -nosplash
3. In MATLAB, navigate to your project folder
4. The extension will automatically create export_workspace.m
5. Variables will update automatically as you work

## Manual Export
Run this command in MATLAB anytime to update the view:
    addpath('.vscode'); export_workspace();

## Auto-refresh Setup (Optional)
Add this to your MATLAB workspace to auto-export every 2 seconds:
    t = timer('ExecutionMode', 'fixedRate', 'Period', 2, ...
             'TimerFcn', @(~,~)export_workspace());
    start(t);
`;

        const panel = vscode.window.createWebviewPanel(
            'matlabSetup',
            'MATLAB Workspace Viewer Setup',
            vscode.ViewColumn.One,
            {}
        );

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: var(--vscode-font-family); padding: 20px; }
                    code { background: var(--vscode-textCodeBlock-background); padding: 2px 6px; border-radius: 3px; }
                    pre { background: var(--vscode-textCodeBlock-background); padding: 10px; border-radius: 5px; overflow-x: auto; }
                    h1 { color: var(--vscode-foreground); }
                    ol { line-height: 1.8; }
                </style>
            </head>
            <body>
                ${message.split('\n').map(line => {
                    if (line.startsWith('# ')) return `<h1>${line.substring(2)}</h1>`;
                    if (line.startsWith('## ')) return `<h2>${line.substring(3)}</h2>`;
                    if (line.trim().match(/^\d+\./)) return `<li>${line.substring(line.indexOf('.') + 1)}</li>`;
                    if (line.trim().startsWith('addpath') || line.trim().startsWith('t = ')) {
                        return `<pre><code>${line.trim()}</code></pre>`;
                    }
                    return line ? `<p>${line}</p>` : '';
                }).join('')}
            </body>
            </html>
        `;
    }

    dispose(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
        this.outputChannel.dispose();
    }
}
