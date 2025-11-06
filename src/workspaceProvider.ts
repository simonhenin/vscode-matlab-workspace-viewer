import * as vscode from 'vscode';
import { MatlabConnection, MatlabVariable } from './matlabConnection';

export class WorkspaceItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly variableName?: string,
        public readonly value?: string,
        public readonly type?: string,
        public readonly size?: string
    ) {
        super(label, collapsibleState);

        if (variableName) {
            this.contextValue = 'variable';
            this.tooltip = this.getTooltip();
            this.description = this.getDescription();
            this.iconPath = new vscode.ThemeIcon(this.getIcon());
        }
    }

    private getTooltip(): string {
        return `${this.variableName}\nType: ${this.type}\nSize: ${this.size}\nValue: ${this.value}`;
    }

    private getDescription(): string {
        // For strings/char arrays, always show the value
        if (this.type === 'char' || this.type === 'string') {
            return this.value || `${this.size} ${this.type}`;
        }

        // For other types, check size
        if (this.value && this.size) {
            const sizeMatch = this.size.match(/\[(\d+)\s+(\d+)\]/);
            if (sizeMatch) {
                const rows = parseInt(sizeMatch[1]);
                const cols = parseInt(sizeMatch[2]);

                // If it's a 1x1 scalar (not struct/cell), show the value
                if (rows === 1 && cols === 1 && this.type !== 'struct' && this.type !== 'cell') {
                    return this.value;
                }

                // For arrays/matrices, show size and type
                return `${rows}x${cols} ${this.type}`;
            }
        }

        // Fallback to value or size+type
        return this.value || `${this.size} ${this.type}`;
    }

    private getIcon(): string {
        if (!this.type) return 'symbol-variable';

        const typeMap: { [key: string]: string } = {
            'double': 'symbol-number',
            'single': 'symbol-number',
            'int8': 'symbol-number',
            'int16': 'symbol-number',
            'int32': 'symbol-number',
            'int64': 'symbol-number',
            'uint8': 'symbol-number',
            'uint16': 'symbol-number',
            'uint32': 'symbol-number',
            'uint64': 'symbol-number',
            'logical': 'symbol-boolean',
            'char': 'symbol-string',
            'string': 'symbol-string',
            'cell': 'symbol-array',
            'struct': 'symbol-struct',
            'table': 'symbol-class',
            'function_handle': 'symbol-method'
        };

        return typeMap[this.type.toLowerCase()] || 'symbol-variable';
    }
}

export class MatlabWorkspaceProvider implements vscode.TreeDataProvider<WorkspaceItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<WorkspaceItem | undefined | null | void> = new vscode.EventEmitter<WorkspaceItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<WorkspaceItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private matlabConnection: MatlabConnection) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: WorkspaceItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: WorkspaceItem): Promise<WorkspaceItem[]> {
        if (element) {
            // Return children for expandable items (future: struct fields, cell contents)
            return [];
        }

        // Get workspace variables
        console.log('[WorkspaceProvider] Getting workspace variables...');
        const variables = await this.matlabConnection.getWorkspaceVariables();
        console.log(`[WorkspaceProvider] Got ${variables.length} variables`);

        if (variables.length === 0) {
            return [new WorkspaceItem('No variables in workspace', vscode.TreeItemCollapsibleState.None)];
        }

        const maxArrayPreview = vscode.workspace.getConfiguration('matlabWorkspace').get<number>('maxArrayPreview', 5);

        return variables.map(v => {
            const displayValue = this.formatValue(v, maxArrayPreview);
            return new WorkspaceItem(
                v.name,
                vscode.TreeItemCollapsibleState.None,
                v.name,
                displayValue,
                v.class,
                v.size
            );
        });
    }

    private formatValue(variable: MatlabVariable, maxPreview: number): string {
        const val = variable.value;

        if (val === undefined || val === null) {
            return '';
        }

        // For arrays, limit preview length
        if (Array.isArray(val)) {
            if (val.length > maxPreview) {
                const preview = val.slice(0, maxPreview).join(', ');
                return `[${preview}, ...]`;
            }
            return `[${val.join(', ')}]`;
        }

        // For strings, truncate if too long
        const strVal = String(val);
        if (strVal.length > 100) {
            return strVal.substring(0, 97) + '...';
        }

        return strVal;
    }
}
