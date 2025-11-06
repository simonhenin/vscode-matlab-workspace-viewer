function export_workspace()
    % Export MATLAB workspace variables to JSON for VSCode extension
    % Run this function in MATLAB to update the workspace view in VSCode

    vars = whos;
    varData = struct([]);

    for i = 1:length(vars)
        varData(i).name = vars(i).name;
        varData(i).size = mat2str(vars(i).size);
        varData(i).class = vars(i).class;

        try
            val = evalin('base', vars(i).name);

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
                varData(i).value = sprintf('struct with fields: %s', strjoin(fields, ', '));
            elseif istable(val)
                varData(i).value = sprintf('table: %dx%d', size(val, 1), size(val, 2));
            else
                varData(i).value = sprintf('<%s>', class(val));
            end
        catch
            varData(i).value = '<error reading value>';
        end
    end

    output.variables = varData;
    output.timestamp = datetime('now');

    jsonStr = jsonencode(output);

    outputFile = fullfile(pwd, '.vscode', 'matlab_workspace.json');

    % Create directory if it doesn't exist
    if ~exist(fullfile(pwd, '.vscode'), 'dir')
        mkdir(fullfile(pwd, '.vscode'));
    end

    fid = fopen(outputFile, 'w');
    fprintf(fid, '%s', jsonStr);
    fclose(fid);

    fprintf('Workspace exported to: %s\n', outputFile);
end
