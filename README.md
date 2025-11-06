# MATLAB Workspace Viewer

A Visual Studio Code extension that displays MATLAB workspace variables in a convenient tree view, similar to the MATLAB IDE's workspace viewer.

## Features

- View all MATLAB workspace variables in VSCode's Explorer sidebar
- Display variable names, types, sizes, and values
- Auto-refresh workspace view at configurable intervals
- Manual refresh button
- Copy variable values to clipboard
- Delete individual variables
- Clear entire workspace
- Icons for different variable types (numbers, strings, arrays, structs, etc.)

## Requirements

- Visual Studio Code 1.85.0 or higher
- [MathWorks MATLAB Extension](https://marketplace.visualstudio.com/items?itemName=MathWorks.language-matlab) (recommended)
- MATLAB installed and accessible

## Installation

### From Source

1. Clone or download this repository
2. Open the folder in VSCode
3. Run `npm install` to install dependencies
4. Run `npm run compile` to build the extension
5. Press F5 to open a new VSCode window with the extension loaded

### From VSIX

1. Build the extension: `vsce package`
2. Install the .vsix file in VSCode: Extensions → ... → Install from VSIX

## Usage

### Quick Start

1. **Open your MATLAB project folder in VSCode**
2. **Open a terminal in VSCode** (Terminal → New Terminal)
3. **Start MATLAB in the terminal**:
   ```bash
   matlab -nodesktop -nosplash
   ```
   Or if you're using the MathWorks MATLAB extension, start MATLAB from there.

4. **In MATLAB, navigate to your project folder** and create some variables:
   ```matlab
   x = 5;
   y = [1, 2, 3, 4, 5];
   name = 'test';
   data = struct('field1', 10, 'field2', 'hello');
   ```

5. **Export workspace** by clicking the download icon in the MATLAB Workspace view, or run:
   ```matlab
   addpath('.vscode'); export_workspace();
   ```

6. **View your variables** in the Explorer sidebar under "MATLAB Workspace"

### Viewing the Workspace

1. Open the Explorer view in VSCode (Ctrl+Shift+E / Cmd+Shift+E)
2. Look for the "MATLAB Workspace" section
3. Variables from your running MATLAB session will appear here

### Commands

- **Export Now** (download icon): Sends `export_workspace()` command to your MATLAB terminal
- **Refresh MATLAB Workspace**: Manually refresh the workspace view
- **Clear MATLAB Workspace**: Sends `clear all` command to MATLAB (requires confirmation)
- **Copy Variable Value**: Right-click a variable to copy its value
- **Delete Variable**: Right-click a variable to delete it from the running MATLAB session

## Configuration

Open VSCode Settings and search for "MATLAB Workspace":

- `matlabWorkspace.refreshInterval`: Auto-refresh interval in milliseconds (default: 2000, set to 0 to disable)
- `matlabWorkspace.maxArrayPreview`: Maximum number of array elements to show in preview (default: 5)

## How It Works

The extension reads workspace data from a JSON file created by MATLAB. There are three methods implemented:

1. **Direct Extension API** (future): If the MathWorks extension exposes a workspace API
2. **File-based** (current): MATLAB writes workspace data to `.vscode/matlab_workspace.json`
3. **Command-based** (planned): Direct communication with MATLAB process

Currently, the file-based method is the most reliable. Run `export_workspace()` in MATLAB whenever you want to update the workspace view in VSCode.

## Supported Variable Types

The extension displays the following MATLAB data types:

- Numeric types (double, single, int8-64, uint8-64)
- Logical arrays
- Character arrays and strings
- Cell arrays
- Structures
- Tables
- Function handles

## Troubleshooting

### No variables showing

1. Make sure you've run `export_workspace()` in MATLAB
2. Check that the `.vscode/matlab_workspace.json` file exists in your workspace
3. Verify the file contains valid JSON
4. Click the refresh button in the MATLAB Workspace view

### Extension not activating

1. Make sure you have a MATLAB file open (.m extension)
2. Check the Output panel (View → Output) and select "MATLAB Workspace" for logs

## Automatic Workspace Updates

To automatically update the workspace view as you work in MATLAB, you can:

1. Add `export_workspace()` to your MATLAB startup script
2. Create a timer in MATLAB:
   ```matlab
   t = timer('ExecutionMode', 'fixedRate', 'Period', 2, ...
            'TimerFcn', @(~,~)export_workspace());
   start(t);
   ```

## Future Enhancements

- Direct integration with MATLAB process (no manual export needed)
- Expandable structs and cell arrays in tree view
- Variable value editing
- Plot generation from workspace variables
- Search and filter capabilities
- Export variables to different formats

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT License - see LICENSE file for details

## Acknowledgments

This extension complements the official [MathWorks MATLAB Extension](https://marketplace.visualstudio.com/items?itemName=MathWorks.language-matlab) by adding workspace viewing capabilities.
