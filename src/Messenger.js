/* Joohansson 2019 */
import React from 'react';
import { Chirp } from 'chirpsdk'
import SimpleCrypto from "simple-crypto-js";
import './Messenger.css';

class Messenger extends React.Component {

  constructor(props) {
    super(props)
    this.sdk = null
    this.state = {
      started: false,
      received: "", //received data as string
      receivedData: new Uint8Array([]), //received in Uint8Array format
      disabled: true, //send button disabled
      decryptDisabled: true, //decrypt button disabled
      downloadDisabled: true, //download button disabled
      message: "", //messeage to be sent
      sendButtonTxt: "SEND 1/1" //label of send button
    }
    this.payloadChunks = [] //send payload divided into parts
    this.payloadCount = 0 //current payload
    this.payloadCountMax = 1 //maxium parts to be sent
    this.shouldReset = true
    this.maxFileSize = 5000 //max bytes to be dropped

    //Bindings
    this.handleFileSelect = this.handleFileSelect.bind(this)
    this.handleMessageChange = this.handleMessageChange.bind(this)
    this.downloadByteArray = this.downloadByteArray.bind(this)

    this.concatTypedArray = require('concat-typed-array');

    this.audioError = `Failed to open web audio stream.
    This may happen if your browser doesn't support Web Audio or have a mic and speaker.`
  }

  componentDidMount() {
    //Init stuff here
    if (!('WebAssembly' in window)) window.alert('WebAssembly is not supported in this browser')
  }

  /**
  * Returns an array with arrays of the given size.
  *
  * @param myArray {Array} array to split
  * @param chunk_size {Integer} Size of every group
  */
  chunkArray(myArray, chunk_size) {
    var index = 0;
    var arrayLength = myArray.length;
    var tempArray = [];

    for (index = 0; index < arrayLength; index += chunk_size) {
      var myChunk = myArray.slice(index, index+chunk_size);
      tempArray.push(myChunk);
    }

    return tempArray;
  }

  // Show/hide how-to section
  collapse() {
    var content = document.getElementsByClassName("collapse-content")[0];
    if (content.style.maxHeight){
      content.style.maxHeight = null;
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
    }
  }

  //Check if all chars in a string is pure hex (not currently used but would cut the payload by 50%)
  checkIfHex(str) {
    const regexp = /^[0-9a-fA-F]+$/
    for (var i = 0; i < str.length; i++) {
      if (!regexp.test(str.charAt(i)))
        {
          return false
        }
    }
    return true
  }

  //When the message body is changed
  handleMessageChange(msg) {
    const key = document.getElementById('psw_input').value
    const result = document.getElementById('resultTxt').value
    this.setState({ message: msg })

    if (key !== "" && result !== "") {
      this.setState({ decryptDisabled: false })
    }
    else {
      this.setState({ decryptDisabled: true })
    }

    //Encrypt message if key is given
    if (key !== "" && msg !== "") {
      var simpleCrypto = new SimpleCrypto(key)
      msg = simpleCrypto.encrypt(msg)
    }

    //Update the button text based on payload length
    this.payloadCountMax = Math.ceil(msg.length / 32)
    if (this.payloadCountMax === 0) {
      this.payloadCountMax = 1
    }

    if (msg !== "") {
      this.setState({ disabled: false })
    }
    else {
      this.setState({ disabled: true })
      this.payloadCountMax = 1
    }

    this.payloadCount = 0
    this.setState({
      sendButtonTxt: "SEND "+(this.payloadCount+1)+"/"+this.payloadCountMax
    })
  }

  //When file is dropped
  handleFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    const scope = this

    var files = evt.dataTransfer.files; // fileList object

    var reader = new FileReader();
    reader.onload = function(theFile) {
      const dataString = reader.result
      if (dataString !== "") {
        scope.setState({
          message: dataString,
          disabled: false
        })
        scope.handleMessageChange(dataString)
      }
    }

    //Read file (only if below max file size)
    const size = files[0].size
    if (size <= this.maxFileSize) {
      reader.readAsBinaryString(files[0])
    }
    else {
      alert("Max file size allowed: 5 KB")
    }
  }

  //File drag over drop zone
  handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
  }

  //For file download link
  destroyClickedElement(event)
  {
    document.body.removeChild(event.target);
  }

  //Download a file from given filename and byteArray
  downloadByteArray(fileName, bytes) {
    //Try get the file type from magic numbers
    const hex = bytes.join('').toUpperCase()
    let type = this.getMimetype(hex)

    var blob = new Blob([bytes], {type: type})

    var downloadLink = document.createElement("a")
    downloadLink.download = fileName
    downloadLink.innerHTML = "Download File"
    if (window.webkitURL != null)
    {
        // Chrome allows the link to be clicked
        // without actually adding it to the DOM.
        downloadLink.href = window.webkitURL.createObjectURL(blob)
    }
    else
    {
        // Firefox requires the link to be added to the DOM
        // before it can be clicked.
        downloadLink.href = window.URL.createObjectURL(blob)
        downloadLink.onclick = this.destroyClickedElement
        downloadLink.style.display = "none"
        document.body.appendChild(downloadLink)
    }

    downloadLink.click();
  }

  //Guess file type
  getMimetype(signature) {
    switch (signature) {
      case '89504E47':
          return 'image/png'
      case '47494638':
          return 'image/gif'
      case '25504446':
          return 'application/pdf'
      case 'FFD8FFDB':
      case 'FFD8FFE0':
          return 'image/jpeg'
      case '504B0304':
          return 'application/zip'
      default:
          return 'text/plain'
    }
  }

  //Initialize the Chirp SDK
  startSDK() {
    Chirp({
      key: 'b2c2e7ed5Acebf8842C1f3F5F',
      onSending: data => {
        console.log("Sending")
        this.setState({
          disabled: true,
          sendButtonTxt: "Sending..."
        })
      },
      onSent: data => {
        console.log("Data sent")
        //Check if there is more data to send
        this.payloadCount++
        if (this.payloadCount >= this.payloadChunks.length) {
          this.payloadCount = 0
        }
        else {
          //TODO: automatically send again (Breaks the event listeners for some reason)
          //this.sendPayload(this.payloadChunks[this.payloadCount]) //example 1
          //document.getElementById("sendButton").click(); //example 2
        }
        this.setState({
          disabled: false,
          sendButtonTxt: "SEND "+(this.payloadCount+1)+"/"+this.payloadCountMax
        })
      },
      onReceiving: () => {
        console.log("Receiving...")
        this.payloadCount = 0 //Reset any sending parts
        this.setState({
          disabled: true,
          sendButtonTxt: "Incoming..."
        })
      },
      onReceived: data => {
        console.log("Data received")
        this.setState({
          sendButtonTxt: "SEND "+(this.payloadCount+1)+"/"+this.payloadCountMax
        })
        if (data.length > 0) {
          var result = ""

          result = new TextDecoder('utf-8').decode(data)

          if (this.shouldReset) {
            //Reset textarea
            this.setState({
              received: "",
              receivedData: new Uint8Array([]),
            })
            this.shouldReset = false
          }

          this.setState({
            receivedData: this.concatTypedArray(Uint8Array,this.state.receivedData,data),
            received: this.state.received+result,
            disabled: false,
          })

          //Enable decrypt button
          const key = document.getElementById('psw_input').value
          if (key !== "") {
            this.setState({ decryptDisabled: false })
          }
          else {
            this.setState({ decryptDisabled: true })
          }
          this.setState({ downloadDisabled: false })
        }
        else {
          this.setState({
            received: "Missed data. Try increase the volume.",
            disabled: false
          })
          this.shouldReset = true
        }
      }
    }).then(sdk => {
      this.sdk = sdk
      this.setState({ started: true })
    }).catch(err => console.error(err) && err.message.includes('WebAssembly') ?
          window.alert(err) : window.alert(this.audioError)
        )
  }

  render() {
    return (
      <div className="App">
        <header><h1>Offline Audio Messenger</h1></header>

        {this.state.started ? (
          <div>
            <button onClick={this.collapse} className="IntroButton">HOW TO</button>
            <div className="collapse-content">
                <strong>No message data is shared but feel free to download site and use offline.<br /></strong>
                <ol>
                    <li>Send message from one device to another using speaker and microphone.</li>
                    <li>If they are far apart you can use a recorder for example a phone app.</li>
                    <li>Use optional encryption to avoid anyone to intercept the audio.</li>
                    <li>Each (non encrypted) part is 32 chars and split automatically.</li>
                    <li>Use same encryption key on the receiving end.</li>
                </ol>
              <br />
            </div>

            <div className="MsgBoxContainer">
              <input className="MsgBox"
                type="text"
                id="message_input"
                placeholder="Enter message"
                value={this.state.message}
                onChange={(event) => {
                  this.handleMessageChange(event.target.value)
                }}
              />

              <div
                id="drop_zone"
                onDragOver={this.handleDragOver}
                onDrop={this.handleFileSelect}>
                ...or drop a file here
              </div>

              <input className="MsgBox"
                type="text"
                id="psw_input"
                placeholder="Encryption key (optional)"
                onChange={(event) => {
                  var msg = document.getElementById('message_input').value
                  this.handleMessageChange(msg)
                }}
              />
            </div>

            {this.state.disabled ? (
              <button id="sendButton" className="SendButton" disabled>{this.state.sendButtonTxt}</button>
              ) : (
              <button id="sendButton" className="SendButton"
                onClick={() => {
                  if (this.payloadCount === 0 || this.payloadCount >= this.payloadChunks.length) {
                    var message = this.state.message
                    const key = document.getElementById('psw_input').value

                    var payload = new Uint8Array(["Unknown"])
                    //Encrypt message if key is given
                    if (key !== "" && message !== "") {
                      var simpleCrypto = new SimpleCrypto(key)
                      message = simpleCrypto.encrypt(message)
                    }
                    if (message !== "") {
                      payload = new TextEncoder('utf-8').encode(message)
                    }

                    //Divide payload into several 32 byte payloads
                    this.payloadChunks = this.chunkArray(payload, 32)
                    this.payloadCountMax = this.payloadChunks.length

                    this.sdk.send(this.payloadChunks[0])
                  }
                  else {
                    this.sdk.send(this.payloadChunks[this.payloadCount])
                  }
                }}
              >{this.state.sendButtonTxt}</button>
              )
            }

            <div className="received-message">
              {<textarea id="resultTxt" className="Result" rows="10" value={this.state.received} placeholder="Waiting on message..." readOnly></textarea>}
            </div>

            <div>
              {this.state.decryptDisabled ? (
                <button id="decryptButton" className="DecryptButton" disabled>DECRYPT</button>
                ) : (
                  <button id="decryptButton" className="DecryptButton"
                    onClick={() => {
                        //Decrypt message
                        var result = document.getElementById("resultTxt").value
                        const key = document.getElementById('psw_input')
                        var simpleCrypto = new SimpleCrypto(key.value)
                        var decrypted = simpleCrypto.decrypt(result)
                        document.getElementById("resultTxt").value = decrypted
                    }
                  }
                >DECRYPT</button>
                )
              }

              <button id="resetButton" className="ResetButton"
                onClick={() => {
                  //Reset textarea
                  this.setState({
                    received: "",
                    receivedData: new Uint8Array([]),
                    message: "",
                    sendButtonTxt: "SEND 1/1",
                    decryptDisabled: true,
                    downloadDisabled: true,
                  })
                  this.payloadCount = 0
                  this.payloadCountMax = 1
                  this.payloadChunks = []
                  }
                }
              >RESET</button>

              {this.state.downloadDisabled ? (
                <button id="downloadButton" className="DownloadButton" disabled>DOWNLOAD</button>
                ) : (
                  <button id="downloadButton" className="DownloadButton"
                    onClick={() => {
                      //Download the bytes shown in text textarea
                      this.downloadByteArray("test.txt", this.state.receivedData)
                    }
                  }
                >DOWNLOAD</button>
                )
              }
            </div>
          </div>
          ) : (
            <button className="StartButton"
              onClick={() => {
                this.startSDK()
              }}
            >START</button>
          )
        }
        <div className = "extra"></div>
        <footer className="Footer"><span>Offline version can be downloaded at </span><a href="https://github.com/Joohansson/offline-audio-messenger">Github</a></footer>
      </div>
    )
  }
}

export default Messenger;
