# IPFS Cat

A simple self-contained webapp for editing/pasting files on IPFS.

## Usage

Open [/ipfs/QmNoFVkagSXcH5NQYkPcNhi4viNzeLKs7ePT7c38kouGiH](https://ipfs.io/ipfs/QmNoFVkagSXcH5NQYkPcNhi4viNzeLKs7ePT7c38kouGiH) and start writing.

## Hacking

First, run:

```sh
npm install
```

Then build a dev version (faster build), run:

```sh
npm run bundle-dev
```

You can then open `index.html` in your browser.

To build a release (smaller) version, run:

```sh
npm run bundle
```

Finally, to upload to IPFS, assuming you have IPFS installed, run:

```sh
npm run ipfs
```

## License

MIT (c) 2017 Protocol Labs
