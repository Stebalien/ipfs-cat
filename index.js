'use strict';

const IPFS = require('ipfs');
const req = require('request');
const concat = require('concat-stream');
const domready = require("domready");
const ace = require("brace");
const JSONStream = require("JSONStream");

const gateway = 'https://ipfs.io';
const api = 'https://ipfs.io';

const node = new Promise((res, rej) => {
  const n = new IPFS();

  n.on('ready', () => res(n));
  n.on('error', rej);
});

// TODO: Put this (well, a less hacky version) in js-ipfs.
function Refs(n, cid) {
  return new Promise((res, rej) => {
    var result = {};
    var remaining = 1;
    function f(cid) {
      n.object.links(cid)
        .then((links) => {
          if (remaining < 0) {
            // Errored
            return;
          }
          remaining--;
          links.forEach((l) => {
            l = l.toJSON();
            if (l.multihash in result) {
              return;
            } else {
              remaining++;
              result[l.multihash] = l.size;
              f(cid);
            }
          });
          if (remaining === 0) {
            res(result);
          }
        }).catch((e) => {
          console.log('fail', e);
          if (remaining > 0) {
            remaining = -1;
            rej(e);
          }
        });
    }
    f(cid);
  });
}

function Upload(hash) {
  return req.get(api + '/api/v0/refs/' + hash + '?recursive=true')
      .pipe(JSONStream.parse(["Ref"]));
}

function PasteFile(buffer, statusCb) {
  if (!statusCb) {
    statusCb = function() {};
  }
  statusCb("adding file...");
  var n, hash;
  return node.then((n_) => {
    n = n_;
  }).then(() => {
    return n.files.add(buffer);
  }).then((result) => {
    statusCb("uploading file...");
    hash = result[0].hash;
  }).then(() => refs(n, hash))
    .then((pieces) => {
      console.log(pieces);
      return new Promise((res, rej) => {
        var total = 0;
        Object.values(pieces).forEach((size) => {
          total += size;
        });
        var progress = 0;

        var uploadProgress = Upload(hash);
        uploadProgress.on('data', (piece) => {
          if (piece in pieces) {
            progress += pieces[piece];
            statusCb(`upload progress: ${Math.round(progress/total * 100)}%`);
          }
        });
        uploadProgress.on('end', () => {
          res(hash);
        });
        uploadProgress.on('error', () => {
          rej(new Error("upload failed"));
        });
        uploadProgress.resume();
      });
    });
}

domready(() => {
  var editor = ace.edit("editor");
  var status = document.getElementById("status");
  var submit = document.getElementById("submit");

  function setHash(hash) {
    window.location.hash = hash;
    status.innerHTML = `SAVED: <a href='${gateway}/ipfs/${hash}'>/ipfs/${hash}</a>`;
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
