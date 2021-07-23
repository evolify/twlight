'use strict';

import * as vscode from 'vscode';
import * as utils from './utils';

const CMD_TOGGLE_ZEN = "workbench.action.toggleZenMode";
const CMD_TOGGLE_TWLIGHT = "twlight.toggle";

let TAB_SIZE = 4;

let enabled = false;
let context = 0;
let opacity = 0.2;
let delay = 200;
let commandScope = true;
let hlRange: vscode.Range[] = [];

let dimDecoration: vscode.TextEditorDecorationType;
let normalDecoration = vscode.window.createTextEditorDecorationType(<vscode.DecorationRenderOptions> {
    textDecoration: 'none; opacity: 1'
});

let lineTable = new Map(); // Line dict

let delayers: { [key: string]: utils.ThrottledDelayer<void> } = Object.create(null);

export function activate(context: vscode.ExtensionContext) {
    console.log('activating the dimmer extension');
    let configRegistration           = vscode.workspace.onDidChangeConfiguration(initialize);
    let selectionRegistration        = vscode.window.onDidChangeTextEditorSelection((e) => updateIfEnabled(e.textEditor));
    let textEditorChangeRegistration = vscode.window.onDidChangeActiveTextEditor(updateIfEnabled);
    let commandRegistration          = vscode.commands.registerCommand('twlight.toggle', () => {
        console.log('toggling activation to', !enabled);
        vscode.workspace.getConfiguration('twlight').update("enabled", !enabled, commandScope);
    });
    let zenModeRegistration          = vscode.commands.registerCommand('twlight.toggleZenMode', () => {
      vscode.commands.executeCommand(CMD_TOGGLE_ZEN);
      vscode.commands.executeCommand(CMD_TOGGLE_TWLIGHT);
  });

    initialize();

    context.subscriptions.push(selectionRegistration, configRegistration, commandRegistration, zenModeRegistration, textEditorChangeRegistration);
}

function updateIfEnabled(textEditor: vscode.TextEditor | undefined) {
    console.log('updated if enabled=', enabled);
    if (enabled && textEditor) {
        setDecorations(textEditor);
    }
}

function initialize()  {
    resetAllDecorations();

    readConfig();
    createDimDecorator();

    setAllDecorations();
}

function readConfig() {
    let config = vscode.workspace.getConfiguration('twlight');
    enabled = config.get('enabled', false);
    commandScope = config.get('toggleDimmerCommandScope', 'user') === 'user';
    opacity = config.get('opacity', 0.2);
}

function resetAllDecorations() {
    vscode.window.visibleTextEditors.forEach(textEditor => {
        resetDecorations(textEditor);
    });
}

function resetDecorations(textEditor: vscode.TextEditor) {
    highlightSelections(textEditor, []);
    undimEditor(textEditor);
}

function setAllDecorations() {
    vscode.window.visibleTextEditors.forEach(updateIfEnabled);
}

function setDecorations(textEditor: vscode.TextEditor) {
    let filename = textEditor.document.fileName;
    let delayer = delayers[filename];
    if (!delayer) {
        delayer = new utils.ThrottledDelayer<void>(delay);
        delayers[filename] = delayer;
    }
    delayer.trigger(() => {
        return Promise.resolve().then(() => {
            console.log('setting decorations after delay')
            dimEditor(textEditor);
            highlightSelections(textEditor, textEditor.selections);
        });
    }, delay);
}

function highlightSelections(editor: vscode.TextEditor, selections: vscode.Range[]) {
    if (!normalDecoration) {
      return ;
    }

    let ranges: vscode.Range[] = [];
    selections.forEach(s => {
        if (context < 0) {
            ranges.push(s);
        }
        else {
            ranges.push(new vscode.Range(
                new vscode.Position(Math.max(s.start.line - context, 0), 0),
                new vscode.Position(s.end.line + context, Number.MAX_VALUE)
            ));
        }
    });
    editor.setDecorations(normalDecoration, ranges);
}

function createDimDecorator() {
    if (dimDecoration) {
        dimDecoration.dispose();
    }
    dimDecoration = vscode.window.createTextEditorDecorationType(<vscode.DecorationRenderOptions> {
        textDecoration: `none; opacity: ${opacity}`
    });
}

function undimEditor(editor: vscode.TextEditor) {
    if (!dimDecoration) return;

    editor.setDecorations(dimDecoration, []);
}

function dimEditor(editor: vscode.TextEditor) {
    console.log('Dimming now!');
    if (!dimDecoration) {
      return;
    }

    // TODO: change this to detect scope as other extension does
    let startPosition = new vscode.Position(0, 0)
    let endPosition = new vscode.Position(editor.document.lineCount, Number.MAX_VALUE);


    if(editor.selection.isSingleLine){
        let topLine = findTop(editor);
        let botLine = findBot(editor, topLine);
        // let hlRange : vscode.Range;

        console.log('topLine:', topLine);
        console.log('botLine:', botLine);

        // If top level statement that doesn't start a block the entire file is in it's context
        // if(editor.document.lineAt(editor.selection.active).firstNonWhitespaceCharacterIndex === 0
        if(getIndentLevel(editor, editor.document.lineAt(editor.selection.active)) === 0
            && !editor.document.lineAt(editor.selection.active).isEmptyOrWhitespace){
            // Do nothing for now
            // this.unhighlightAll(editor);
            console.log('doing nothing')
        }else{
            // hlRange = new vscode.Range(topLine.lineNumber,0 ,
                // botLine.lineNumber, Number.MAX_VALUE);

            console.log('else clause')
            hlRange[0] = new vscode.Range(0, 0,
                topLine.lineNumber - 1, Number.MAX_VALUE);
            console.log('first range')
            hlRange[1] = new vscode.Range(botLine.lineNumber + 1, 0,
                editor.document.lineCount, Number.MAX_VALUE);

            console.log('hlRange:', hlRange)
            // this.highlightRange(editor, hlRange);
        }
    }

    // hlRange = new vscode.Range(startPosition, endPosition)

    console.log('setting range to:', hlRange)
    // editor.setDecorations(dimDecoration, [new vscode.Range(startPosition, endPosition)]);
    editor.setDecorations(dimDecoration, hlRange);
}

function findTop(editor :vscode.TextEditor){
    let line : vscode.TextLine = editor.document.lineAt(editor.selection.active);
    //If whitespace selected process closest nonwhitespace above it
    while(line.isEmptyOrWhitespace && line.lineNumber > 0){
        line = editor.document.lineAt(line.lineNumber - 1);
    }
    if(line.lineNumber < editor.document.lineCount - 1 && !line.isEmptyOrWhitespace){
        let nextLine = editor.document.lineAt(line.lineNumber + 1);
        // Find first nonwhitespace line
        while(nextLine.isEmptyOrWhitespace && nextLine.lineNumber < editor.document.lineCount - 1){
            nextLine = editor.document.lineAt(nextLine.lineNumber + 1);
        }
    }
    let indentLevel = NaN;
    while(line.lineNumber > 0){
        if(!line.isEmptyOrWhitespace){
            let nextLevel = getIndentLevel(editor,line);
            if(Number.isNaN(indentLevel)){
                indentLevel = nextLevel;
            }
            if(nextLevel === 0){
                return line;
            }
            if(nextLevel < indentLevel){
                return line;
            }
        }
        line = editor.document.lineAt(line.lineNumber - 1);
    }
    return line;
}

function findBot(editor : vscode.TextEditor, topLine : vscode.TextLine){
    let line : vscode.TextLine = editor.document.lineAt(topLine.lineNumber + 1);
    let baseLevel = getIndentLevel(editor, editor.document.lineAt(editor.selection.active));
    while(line.lineNumber < editor.document.lineCount - 1){
        if(!line.isEmptyOrWhitespace){
            let nextLevel = getIndentLevel(editor, line);
            if(nextLevel < baseLevel || nextLevel === 0){
            //if(nextLevel <= this.getIndentLevel(editor, topLine)){
                return line;
            }
        }
        line = editor.document.lineAt(line.lineNumber + 1);
    }
    console.log("EOF Reached");
    return line;
}

/**
* Parses a line to get the indentation level manually
* Assumes line is already non-whitespace
* @param line Line to parse
* @returns Number of space-equivalents in the line
**/
function getIndentLevel(editor: vscode.TextEditor, line : vscode.TextLine){
   // Deleet Cache block?
   //if(lineTable.has(line)){
   //   return lineTable.get(line);
   // }else{
   let indentLevel = line.firstNonWhitespaceCharacterIndex;
   let lineText = line.text;
   for(var i = 0; i < indentLevel; i++){
       if(lineText.charAt(i) === '\t'){
           indentLevel+= (TAB_SIZE - 1);
       }
   }
   lineTable.set(line, indentLevel);
   return indentLevel;

   // Cache block end
   // }
}

function changeActive(){
    console.log("Active Window Changed");
    setCurrentDocumentTabSize();
}

function setCurrentDocumentTabSize(){
    let editor = vscode.window.activeTextEditor;
    if(!editor){
        return;
    }
    let tabs : number;
    tabs = editor.options.tabSize as number;
    TAB_SIZE = tabs;
    console.log("Tab size of current document: " + TAB_SIZE);
}



export function deactivate() {
    resetAllDecorations();
}