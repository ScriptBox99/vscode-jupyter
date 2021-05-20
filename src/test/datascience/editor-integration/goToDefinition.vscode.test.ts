// Licensed under the MIT License.
// Copyright (c) Microsoft Corporation. All rights reserved.

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports, no-invalid-this, @typescript-eslint/no-explicit-any */
import { assert } from 'chai';
import * as path from 'path';
import * as fs from 'fs-extra';
import { NotebookEditor as VSCNotebookEditor, commands, workspace } from 'vscode';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { traceInfo } from '../../../client/common/logger';
import { IDisposable } from '../../../client/common/types';
import { sleep } from '../../../client/common/utils/async';
import { PylanceExtension, PythonExtension } from '../../../client/datascience/constants';
import { IExtensionTestApi, openFile, verifyExtensionIsAvailable } from '../../common';
import { closeActiveWindows, EXTENSION_ROOT_DIR_FOR_TESTS, initialize } from '../../initialize';
import {
    canRunNotebookTests,
    closeNotebooksAndCleanUpAfterTests,
    createEmptyPythonNotebook,
    insertCodeCell,
    runAllCellsInActiveNotebook,
    selectCell,
    startJupyterServer,
    trustAllNotebooks,
    waitForExecutionCompletedSuccessfully,
    waitForKernelToGetAutoSelected
} from '../notebook/helper';

suite('DataScience - Go To Definition', function () {
    this.timeout(120_000);

    let api: IExtensionTestApi;
    const disposables: IDisposable[] = [];
    let vscodeNotebook: IVSCodeNotebook;
    let vscEditor: VSCNotebookEditor;

    suiteSetup(async function () {
        traceInfo(`Start Suite Test`);
        api = await initialize();
        if (!(await canRunNotebookTests())) {
            return this.skip();
        }

        await verifyExtensionIsAvailable(PylanceExtension);
        await verifyExtensionIsAvailable(PythonExtension);
        const pythonConfig = workspace.getConfiguration('python', null);
        await pythonConfig.update('languageServer', 'Pylance', true);
        // await pythonConfig.update('trace.server', 'verbose', true);
        // "python.trace.server": "verbose"
        // await pythonConfig.update('languageServer', 'Microsoft', true);

        await startJupyterServer();
        await closeNotebooksAndCleanUpAfterTests();

        vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);

        traceInfo(`Start Suite Test Complete`);
    });
    teardown(closeActiveWindows);
    suiteTeardown(closeActiveWindows);

    test('Go To Definition in the same notebook', async () => {
        const file = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'test',
            'pythonFiles',
            'datascience',
            'simple_note_book.py'
        );
        const outputFile = path.join(path.dirname(file), 'ds.log');
        if (await fs.pathExists(outputFile)) {
            await fs.unlink(outputFile);
        }
        await openFile(file);

        // Wait for code lenses to get detected.
        await sleep(1_000);

        await trustAllNotebooks();
        await createEmptyPythonNotebook(disposables);
        vscEditor = vscodeNotebook.activeNotebookEditor!;

        await insertCodeCell('def add(a,b):\n\treturn a+b', { index: 0 });
        await insertCodeCell('add(2,3)', { index: 1 });

        await waitForKernelToGetAutoSelected();
        const cell2 = vscodeNotebook.activeNotebookEditor!.document.cellAt(1)!;
        await runAllCellsInActiveNotebook();
        // Wait for Jupyter to start.
        await waitForExecutionCompletedSuccessfully(cell2, 60_000);

        // put cursor on 'add'
        await selectCell(vscEditor.document, 1, 2);
        await sleep(40000);
        // const textEditors = window.visibleTextEditors;
        // textEditors[1].selection = new Selection(new Position(0, 0), new Position(0, 1));

        // Run the F12 command
        await commands.executeCommand('editor.action.revealDefinition');
        await sleep(60000);

        // Check that the first cell gets selected
        assert.equal(vscEditor.selections[0].start, 0);
        assert.equal(vscEditor.selections[0].end, 1);
    });

    // test('Go To Definition of a python import', async () => {
    //     await trustAllNotebooks();
    //     await createEmptyPythonNotebook(disposables);
    //     vscEditor = vscodeNotebook.activeNotebookEditor!;

    //     await insertCodeCell(`import os,sys\nsys.path.append(os.path.abspath('..'))`, { index: 0 });

    //     // put cursor on 'sys'
    //     await selectCell(vscEditor.document, 0, 1);
    //     const textEditors = window.visibleTextEditors;
    //     textEditors[0].selection = new Selection(new Position(1, 0), new Position(1, 1));

    //     // Run the F12 command
    //     await commands.executeCommand('editor.action.revealDefinition');

    //     // Check that a python file opened
    //     assert.equal(window.activeTextEditor?.document.languageId, 'python');
    // });
});
