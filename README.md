
# Offline Audio Messenger

Send messages or files between devices using an encrypted audio transfer.
For example when using an air-gapped (offline) computer and need to transfer keys for offline signing of a cryptocurrency transaction. The message does not touch the Internet.

Either run the site online below, unplug the Internet before sending anything or download and run locally (no web server is needed)

[Public Site](https://joohansson.github.io/offline-audio-messenger/)

## Install and run application locally

Download [the zip here](https://github.com/Joohansson/offline-audio-messenger/raw/master/offline-audio-messenger.zip)

Disconnect your Internet connection, extract the zip and open index.html in an safe OS environment.

## Notes

Offline mode may not work in every browser and OS. Tested with Firefox and Chrome in Ubuntu.

## Developer instructions

### Prepare for build (Ubuntu example)`

`apt-get install`\
`git clone https://github.com/Joohansson/offline-audio-messenger`\
`cd offline-audio-messenger`\
`npm install`

### Build application

`npm start`

Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

`npm run build`

Builds the app for production to the `build` folder.<br>
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!


## Contribution

Find this useful? Send me a Nano donation at `nano_1gur37mt5cawjg5844bmpg8upo4hbgnbbuwcerdobqoeny4ewoqshowfakfo`
