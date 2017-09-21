'use strict';

const IPFS = require('ipfs');
const req = require('request-promise-native');
const concat = require('concat-stream');
const domready = require("domready");
const ace = require("brace");

const node = new Promise((res, rej) => {
  const n = new IPFS();
  n.on('ready', () => res(n));
  n.on('error', rej);
});

function Upload(hash) {
  // TODO: Progress (we know enough to determine this)
  return req.get('https://ipfs.io/api/v0/refs/' + hash + '?recursive=true');
}

function PasteFile(buffer, statusCb) {
  if (!statusCb) {
    statusCb = function() {};
  }
  statusCb("adding file...");
  return node.then((n) => {
    return n.files.add(buffer);
  }).then((result) => {
    statusCb("uploading file...");
    let hash = result[0].hash;
    let url = 'https://ipfs.io/ipfs/' + hash;
    return Upload(hash).then(() => hash);
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
    // TODO: n.files.cat doesn't work for some reason...
    node.then((n) => {
      return n.files.get(hash);
    }).then((stream) => {
      return new Promise((res, rej) => {
        var found = false;
        stream.on('data', (f) => {
          if (f.path === hash) {
            found = true;
            f.content.on('error', (e) => rej(e));
            f.content.pipe(concat(res));
          }
        });
        stream.on('end', () => {
          if (!found) {
            rej(new Error("File Not Found"));
          }
        });
        stream.on('error', (e) => {
          // Otherwise, this will be rejected by the file's stream.
          if (!found) {
            rej(e);
          }
        });
        stream.resume();
      });
    }).then((data) => {
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

