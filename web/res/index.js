/**
 * @license
 * Copyright 2012 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Loading and saving blocks with localStorage and cloud storage.
 * @author q.neutron@gmail.com (Quynh Neutron)
 */
'use strict';

// Create a namespace.
var BlocklyStorage = {};

/**
 * Backup code blocks to localStorage.
 * @param {!Blockly.WorkspaceSvg} workspace Workspace.
 * @private
 */
BlocklyStorage.backupBlocks_ = function(workspace) {
  if ('localStorage' in window) {
    var xml = Blockly.Xml.workspaceToDom(workspace);
    // Gets the current URL, not including the hash.
    var url = window.location.href.split('#')[0];
    window.localStorage.setItem(url, Blockly.Xml.domToText(xml));
  }
};

/**
 * Bind the localStorage backup function to the unload event.
 * @param {Blockly.WorkspaceSvg=} opt_workspace Workspace.
 */
BlocklyStorage.backupOnUnload = function(opt_workspace) {
  var workspace = opt_workspace || Blockly.getMainWorkspace();
  window.addEventListener('unload',
      function() {BlocklyStorage.backupBlocks_(workspace);}, false);
};

/**
 * Restore code blocks from localStorage.
 * @param {Blockly.WorkspaceSvg=} opt_workspace Workspace.
 */
BlocklyStorage.restoreBlocks = function(opt_workspace) {
  var url = window.location.href.split('#')[0];
  if ('localStorage' in window && window.localStorage[url]) {
    var workspace = opt_workspace || Blockly.getMainWorkspace();
    var xml = Blockly.Xml.textToDom(window.localStorage[url]);
    Blockly.Xml.domToWorkspace(xml, workspace);
  }
};

/**
 * Save blocks to database and return a link containing key to XML.
 * @param {Blockly.WorkspaceSvg=} opt_workspace Workspace.
 */
BlocklyStorage.link = function(opt_workspace) {
  var workspace = opt_workspace || Blockly.getMainWorkspace();
  var xml = Blockly.Xml.workspaceToDom(workspace, true);
  // Remove x/y coordinates from XML if there's only one block stack.
  // There's no reason to store this, removing it helps with anonymity.
  if (workspace.getTopBlocks(false).length == 1 && xml.querySelector) {
    var block = xml.querySelector('block');
    if (block) {
      block.removeAttribute('x');
      block.removeAttribute('y');
    }
  }
  var data = Blockly.Xml.domToText(xml);
  BlocklyStorage.makeRequest_('/storage', 'xml', data, workspace);
};

/**
 * Retrieve XML text from database using given key.
 * @param {string} key Key to XML, obtained from href.
 * @param {Blockly.WorkspaceSvg=} opt_workspace Workspace.
 */
BlocklyStorage.retrieveXml = function(key, opt_workspace) {
  var workspace = opt_workspace || Blockly.getMainWorkspace();
  BlocklyStorage.makeRequest_('/storage', 'key', key, workspace);
};

/**
 * Global reference to current AJAX request.
 * @type {XMLHttpRequest}
 * @private
 */
BlocklyStorage.httpRequest_ = null;

/**
 * Fire a new AJAX request.
 * @param {string} url URL to fetch.
 * @param {string} name Name of parameter.
 * @param {string} content Content of parameter.
 * @param {!Blockly.WorkspaceSvg} workspace Workspace.
 * @private
 */
BlocklyStorage.makeRequest_ = function(url, name, content, workspace) {
  if (BlocklyStorage.httpRequest_) {
    // AJAX call is in-flight.
    BlocklyStorage.httpRequest_.abort();
  }
  BlocklyStorage.httpRequest_ = new XMLHttpRequest();
  BlocklyStorage.httpRequest_.name = name;
  BlocklyStorage.httpRequest_.onreadystatechange =
      BlocklyStorage.handleRequest_;
  BlocklyStorage.httpRequest_.open('POST', url);
  BlocklyStorage.httpRequest_.setRequestHeader('Content-Type',
      'application/x-www-form-urlencoded');
  BlocklyStorage.httpRequest_.send(name + '=' + encodeURIComponent(content));
  BlocklyStorage.httpRequest_.workspace = workspace;
};

/**
 * Callback function for AJAX call.
 * @private
 */
BlocklyStorage.handleRequest_ = function() {
  if (BlocklyStorage.httpRequest_.readyState == 4) {
    if (BlocklyStorage.httpRequest_.status != 200) {
      BlocklyStorage.alert(BlocklyStorage.HTTPREQUEST_ERROR + '\n' +
          'httpRequest_.status: ' + BlocklyStorage.httpRequest_.status);
    } else {
      var data = BlocklyStorage.httpRequest_.responseText.trim();
      if (BlocklyStorage.httpRequest_.name == 'xml') {
        window.location.hash = data;
        BlocklyStorage.alert(BlocklyStorage.LINK_ALERT.replace('%1',
            window.location.href));
      } else if (BlocklyStorage.httpRequest_.name == 'key') {
        if (!data.length) {
          BlocklyStorage.alert(BlocklyStorage.HASH_ERROR.replace('%1',
              window.location.hash));
        } else {
          BlocklyStorage.loadXml_(data, BlocklyStorage.httpRequest_.workspace);
        }
      }
      BlocklyStorage.monitorChanges_(BlocklyStorage.httpRequest_.workspace);
    }
    BlocklyStorage.httpRequest_ = null;
  }
};

/**
 * Start monitoring the workspace.  If a change is made that changes the XML,
 * clear the key from the URL.  Stop monitoring the workspace once such a
 * change is detected.
 * @param {!Blockly.WorkspaceSvg} workspace Workspace.
 * @private
 */
BlocklyStorage.monitorChanges_ = function(workspace) {
  var startXmlDom = Blockly.Xml.workspaceToDom(workspace);
  var startXmlText = Blockly.Xml.domToText(startXmlDom);
  function change() {
    var xmlDom = Blockly.Xml.workspaceToDom(workspace);
    var xmlText = Blockly.Xml.domToText(xmlDom);
    if (startXmlText != xmlText) {
      window.location.hash = '';
      workspace.removeChangeListener(change);
    }
  }
  workspace.addChangeListener(change);
};

/**
 * Load blocks from XML.
 * @param {string} xml Text representation of XML.
 * @param {!Blockly.WorkspaceSvg} workspace Workspace.
 * @private
 */
BlocklyStorage.loadXml_ = function(xml, workspace) {
  try {
    xml = Blockly.Xml.textToDom(xml);
  } catch (e) {
    BlocklyStorage.alert(BlocklyStorage.XML_ERROR + '\nXML: ' + xml);
    return;
  }
  // Clear the workspace to avoid merge.
  workspace.clear();
  Blockly.Xml.domToWorkspace(xml, workspace);
};

/**
 * Present a text message to the user.
 * Designed to be overridden if an app has custom dialogs, or a butter bar.
 * @param {string} message Text to alert.
 */
BlocklyStorage.alert = function(message) {
  window.alert(message);
};


var theme = {
   "list_blocks": {
      "colourPrimary": "#4a148c",
      "colourSecondary":"#AD7BE9",
      "colourTertiary":"#CDB6E9"
   },
   "logic_blocks": {
      "colourPrimary": "#01579b",
      "colourSecondary":"#64C7FF",
      "colourTertiary":"#C5EAFF"
   }
};

var zoom = {
    controls: true,
    wheel: true,
    startScale: 1.0,
    maxScale: 3,
    minScale: 0.3,
    scaleSpeed: 1.2,
    pinch: true
 };

 Blockly.Blocks['require'] = {
  init: function() {
    this.setInputsInline(true);

    this.setTooltip("Import Go package");
    this.setHelpUrl("");
    this.setColour(230);
    this.appendValueInput('VALUE')
    .setCheck('String')
    .appendField('Import');
  }
};

Blockly.JavaScript['require'] = function(block) {

  var value_name = Blockly.JavaScript.valueToCode(block, 'VALUE', Blockly.JavaScript.ORDER_ATOMIC);

  //var text_hostname = block.getFieldValue('hostname');
  //var statements_name = Blockly.JavaScript.statementToCode(block, 'NAME');
  // TODO: Assemble JavaScript into code variable.
  console.log(value_name);
  var code = `import ${value_name.split("'").join('"')}
  `;
  return code;
};


Blockly.Blocks['server'] = {
  init: function() {
    this.appendStatementInput("children")
        .setCheck(["port", "hostname", "endpoints", "on_start"])
        .appendField("Server");

    this.appendDummyInput()
        .appendField("Port")
        .appendField(new Blockly.FieldNumber(8080), "port");
    this.appendDummyInput()
        .appendField("Hostname")
        .appendField(new Blockly.FieldTextInput("127.0.0.1"), "hostname");

    this.setInputsInline(true);
    this.setColour(105);
    this.setTooltip("Defines a server root");

    this.setHelpUrl("");
  }
};


Blockly.Blocks['route_group'] = {
  init: function() {
    this.appendStatementInput("NAME")
        .setCheck("route")
        .appendField("Route Group");


    this.setPreviousStatement(true, null);

    this.setColour(345);
    this.setTooltip("Define a Web api route group");
    this.setHelpUrl("");
  }
};


Blockly.JavaScript['route_group'] = function(block) {

  //var value_name = Blockly.JavaScript.valueToCode(block, 'VALUE', Blockly.JavaScript.ORDER_ATOMIC);

  //var text_hostname = block.getFieldValue('hostname');
  var statements_name = Blockly.JavaScript.statementToCode(block, 'NAME');

  console.log(statements_name);
  var code = `
  apiHandler := func(w http.ResponseWriter, r *http.Request) {
     path := ""
     ${statements_name}
  }`;
  return code;
};


Blockly.Blocks['route'] = {
  init: function() {
    this.appendDummyInput()
        .appendField("Route");
    this.appendDummyInput()
        .appendField("Path")
        .appendField(new Blockly.FieldTextInput("/hello"), "path");
    this.appendDummyInput()
        .appendField("Method")
        .appendField(new Blockly.FieldDropdown([["GET","GET"], ["PUT","PUT"], ["POST","POST"],  ["DELETE","DELETE"],["OPTION","OPTION"]]), "method");
    this.appendStatementInput("sub")
        .setCheck("route")
        .appendField("Sub routes");
    this.appendDummyInput()
        .appendField("Handler")
        .appendField(new Blockly.FieldTextInput("pkg.Handler(w, *r)"), "handler");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(345);
 this.setTooltip("Individual route");
 this.setHelpUrl("");
  }
};

Blockly.JavaScript['route'] = function(block) {

  //var value_name = Blockly.JavaScript.valueToCode(block, 'VALUE', Blockly.JavaScript.ORDER_ATOMIC);

  var path = block.getFieldValue('path');
  var method = block.getFieldValue('method');
  var handler = block.getFieldValue('handler');

  var statements_name = Blockly.JavaScript.statementToCode(block, 'sub');

  console.log(statements_name);
  var code = `
  if strings.Contains(r.URL.Path, "${path}") && r.Method == "${method}" {
     path = path + "${path}"
     ${statements_name}
     ${handler}
     return
  }`;
  return code;
};



Blockly.Blocks['on_start'] = {
  init: function() {
    this.appendStatementInput("NAME")
        .setCheck("go")
        .appendField("On Server start");
    this.setInputsInline(false);
    this.setPreviousStatement(true, ["on_start", "go", "on_shutdown", "on_recover"]);
    this.setNextStatement(true, ["on_start", "go", "on_shutdown", "on_recover"]);
    this.setColour(230);
    this.setTooltip("Code to run on server boot");
    this.setHelpUrl("");
  }
};

Blockly.JavaScript['on_start'] = function(block) {

  //var value_name = Blockly.JavaScript.valueToCode(block, 'VALUE', Blockly.JavaScript.ORDER_ATOMIC);

  //var text_hostname = block.getFieldValue('hostname');
  var statements_name = Blockly.JavaScript.statementToCode(block, 'NAME');

  console.log(statements_name);
  var code = statements_name;
  return code;
};

/*
stop := make(chan os.Signal, 1)

   signal.Notify(stop, os.Interrupt)

*/

Blockly.Blocks['on_shutdown'] = {
  init: function() {
    this.appendStatementInput("NAME")
        .setCheck("go")
        .appendField("On Server shutdown");
    this.setInputsInline(false);
    this.setPreviousStatement(true, ["on_start", "go", "on_shutdown", "on_recover"]);
    this.setNextStatement(true, ["on_start", "go", "on_shutdown", "on_recover"]);
    this.setColour(230);
    this.setTooltip("Code to run on server exit");
    this.setHelpUrl("");
  }
};

Blockly.JavaScript['on_shutdown'] = function(block) {

  //var value_name = Blockly.JavaScript.valueToCode(block, 'VALUE', Blockly.JavaScript.ORDER_ATOMIC);

  //var text_hostname = block.getFieldValue('hostname');
  var statements_name = Blockly.JavaScript.statementToCode(block, 'NAME');

  var code = `
  stop := make(chan os.Signal, 1)
   signal.Notify(stop, os.Interrupt)
  
   go func() {
      <-stop
       log.Println("Shutting down the server...")

       ctx, _ := context.WithTimeout(context.Background(), 5*time.Second)
       h.Shutdown(ctx)

       ${statements_name}
       log.Println("Server gracefully stopped")
   }()
  `;

  return code;
};

Blockly.Blocks['go'] = {
  init: function() {
    this.appendDummyInput()
        .appendField("Go ")
        .appendField(new Blockly.FieldTextInput("println(\"Sample\")"), "line")
        
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(230);
 this.setTooltip("Line of Go code");
 this.setHelpUrl("");
  }
};

Blockly.JavaScript['go'] = function(block) {

  //var value_name = Blockly.JavaScript.valueToCode(block, 'VALUE', Blockly.JavaScript.ORDER_ATOMIC);

  var text = block.getFieldValue('line');
  //var statements_name = Blockly.JavaScript.statementToCode(block, 'NAME');

  var code = `${text}
  `;
  return code;
};


// Code gen

Blockly.JavaScript['server'] = function(block) {
  var number_port = block.getFieldValue('port');
  var text_hostname = block.getFieldValue('hostname');
  var statements_name = Blockly.JavaScript.statementToCode(block, 'children');
  // TODO: Assemble JavaScript into code variable.
  console.log(statements_name);

  var code = `
import "context"
import "log"
import "os"
import "os/signal"
import "time"
import "strings"

func main() {

   h := &http.Server{Addr:  "${text_hostname}:${number_port}" }

   
   ${statements_name}

   http.HandleFunc("/", apiHandler)

   
   err := h.ListenAndServe()
   if err != nil {
      log.Println(err)
   }

}
`;
  return code;
};


var xmlToString = (xml) => {

   var s = new XMLSerializer();
   var str = s.serializeToString(xml);

}


var stringToXml = (str) => {

   let parser = new DOMParser()
   let doc = parser.parseFromString(str, "application/xml")
   return doc;
}

var workspace = Blockly.inject('blocklyDiv',{
    toolbox: document.getElementById('toolbox'),
    theme : theme,
     trashcan : true,
     maxTrashcanContents : 0,
     zoom
});

setTimeout(BlocklyStorage.restoreBlocks, 300);

BlocklyStorage.backupOnUnload();

var setDefault = () => {
   var temp = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="require" id="JqCkcv]bLOT(jC7{8@NO" x="29" y="14"><value name="VALUE"><block type="text" id="ghuK=W/u%?LQz%.Ut`_r"><field name="TEXT">net/http</field></block></value></block></xml>'

   var xml = Blockly.Xml.textToDom(temp);
   Blockly.Xml.domToWorkspace(xml, workspace);

}

var exportCode = () => {
   var pkgName = document.getElementById("pkgName").value;
   var zip = new JSZip();
   var cmd = zip.folder("cmd");
   var code = Blockly.JavaScript.workspaceToCode(workspace);
   cmd.file("main.go", "package main\n" + code );
   
   zip.generateAsync({type:"blob"})
   .then(function(content) {
       // see FileSaver.js
       saveAs(content, pkgName.split("/").join(".") + ".zip");
   });
}

//var xml = Blockly.Xml.textToDom(testXml);
//Blockly.Xml.domToWorkspace(xml, workspace);
