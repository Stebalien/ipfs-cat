'use strict';

const IPFS = require('ipfs');
const req = require('request-promise-native');
const domready = require("domready");
const ace = require("brace");

const node = new IPFS();
let fileMultihash;

function GetFile(hash) {
  // TODO: Don't actually download the file.
  return req.get('https://ipfs.io/ipfs/' + hash);
}

function PasteFile(buffer, statusCb) {
  if (!statusCb) {
    statusCb = function() {};
  }
  statusCb("adding file...");
  return node.files.add(buffer).then((result) => {
    statusCb("uploading file...");
    let hash = result[0].hash;
    let url = 'https://ipfs.io/ipfs/' + hash;
    return GetFile(hash).then(() => hash);
  });
}

domready(() => {
  var editor = ace.edit("editor");
  var status = document.getElementById("status");
  var submit = document.getElementById("submit");

  function setHash(hash) {
    window.location.hash = hash;
    status.innerHTML = `SAVED: <a href='https://ipfs.io/ipfs/${hash}'>/ipfs/${hash}</a>`;
    editor.once("change", function() {
      status.innerText = "unsaved";
      window.location.hash = '';
    });
  }

  function setError(error) {
    console.log(error);
    status.innerText = "ERROR: " + error.toString();
  }

  function setStatus(msg) {
    status.innerText = msg;
  }

  function setReadOnly(state) {
    editor.setReadOnly(state);
    submit.disable = state;
  }

  setReadOnly(true);

  var hash = window.location.hash.substring(1);
  if (hash !== "") {
    // TODO: Use IPFS for this. Didn't work for some reason...
    GetFile(hash).then((data) => {
      editor.setValue(data.toString());
      setHash(hash);
      setReadOnly(false);
    }).catch((err) => setError(err));
  } else {
    editor.setValue("");
    // The empty string hash.
    setHash("Qmc5m94Gu7z62RC8waSKkZUrCCBJPyHbkpmGzEePxy2oXJ");
    setReadOnly(false);
  }

  submit.addEventListener("click", function(e) {
    setReadOnly(true);
    PasteFile(Buffer.from(editor.getValue()), setStatus)
      .then((hash) => setHash(hash))
      .catch((err) => setError(err))
      .then(() => setReadOnly(false));
  });
});

